import assert from "node:assert/strict";
import { test } from "vitest";
import {
	convertThroughSteps,
	isRegrouped,
	startValues,
} from "../src/conversion/convert.ts";
import {
	carrySource,
	type BlockReason,
	type Step,
	type StepEdge,
} from "../src/conversion/crosswalkSteps.ts";
import { boundsOf } from "../src/conversion/errorModel.ts";

const row = (
	t: number,
	fields: Partial<{
		exact_rule: number;
		weight: number | null;
		source_share: number | null;
		coverage: number | null;
	}> = {},
) => ({
	t,
	exact_rule: 0,
	weight: null,
	source_share: null,
	coverage: null,
	...fields,
});

const whole = (to: number) => ({
	edges: [{ to, weight: 1, risk: 0, pruned: 0, crosswalk: 7 }],
});

test("an exact edge carries the whole area, and several exact edges block it", () => {
	const crosswalk = { id: 7, method: "official-lookup" };
	assert.deepEqual(
		carrySource(crosswalk, [row(10, { exact_rule: 1 })]),
		whole(10),
	);
	assert.deepEqual(
		carrySource(crosswalk, [
			row(10, { exact_rule: 1 }),
			row(11, { exact_rule: 1 }),
		]),
		{ blocked: "ambiguous-membership", targets: [10, 11] },
	);
});

test("a single measured edge is whole only at the whole share", () => {
	const overlap = { id: 7, method: "postcode-overlap" };
	assert.deepEqual(
		carrySource(overlap, [row(10, { weight: 1, coverage: 0.9995 })]),
		whole(10),
	);
	// The pruned pairs put 2% elsewhere, so the value is not a regrouping.
	const pruned = carrySource(overlap, [
		row(10, { weight: 1, coverage: 0.98 }),
	]);
	assert.ok("edges" in pruned);
	assert.equal(pruned.edges[0]!.weight, 1);
	assert.ok(Math.abs(pruned.edges[0]!.pruned - 0.02) < 1e-12);
	assert.deepEqual(
		carrySource({ id: 7, method: "best-fit" }, [
			row(10, { weight: 1, source_share: 0.8 }),
		]),
		{ blocked: "best-fit-straddler", targets: [10] },
	);
	assert.deepEqual(carrySource(overlap, [row(10)]), {
		blocked: "no-weight",
		targets: [10],
	});
});

test("a split needs every weight, and weights that sum to 1", () => {
	const crosswalk = { id: 7, method: "population-overlap" };
	assert.deepEqual(
		carrySource(crosswalk, [row(10, { weight: 0.4 }), row(11)]),
		{ blocked: "no-weight", targets: [10, 11] },
	);
	assert.deepEqual(
		carrySource(crosswalk, [
			row(10, { weight: 0.4 }),
			row(11, { weight: 0.5 }),
		]),
		{ blocked: "weights-do-not-sum", targets: [10, 11] },
	);
	const split = carrySource(crosswalk, [
		row(10, { weight: 0.25 }),
		row(11, { weight: 0.75 }),
	]);
	assert.ok("edges" in split);
	assert.deepEqual(
		split.edges.map((edge) => [edge.to, edge.weight, edge.risk]),
		[
			[10, 0.25, 0.1875],
			[11, 0.75, 0.1875],
		],
	);
});

const step = (
	edges: Record<number, Partial<StepEdge>[]>,
	blocked: Record<number, { reason: BlockReason; targets: number[] }> = {},
): Step => {
	const feeders = new Map<number, number[]>();
	const feed = (source: number, target: number) =>
		feeders.set(target, [...(feeders.get(target) ?? []), source]);
	for (const [source, list] of Object.entries(edges))
		for (const edge of list) feed(Number(source), edge.to!);
	for (const [source, entry] of Object.entries(blocked))
		for (const target of entry.targets) feed(Number(source), target);
	return {
		fromRelease: 1,
		toRelease: 2,
		crosswalks: [],
		reversed: false,
		edges: new Map(
			Object.entries(edges).map(([source, list]) => [
				Number(source),
				list.map((edge) => ({
					to: edge.to!,
					weight: edge.weight ?? 1,
					risk: edge.risk ?? 0,
					pruned: edge.pruned ?? 0,
					crosswalk: edge.crosswalk ?? 7,
				})),
			]),
		),
		blocked: new Map(
			Object.entries(blocked).map(([source, entry]) => [
				Number(source),
				entry,
			]),
		),
		feeders,
	};
};

test("whole areas regroup exactly and a count is conserved through a split", () => {
	const converted = convertThroughSteps(
		[
			step({
				1: [{ to: 10 }],
				2: [{ to: 10 }],
				3: [
					{ to: 11, weight: 0.25, risk: 0.1875 },
					{ to: 12, weight: 0.75, risk: 0.1875 },
				],
				4: [{ to: 12 }],
			}),
		],
		startValues([
			[1, 100],
			[2, 50],
			[3, 80],
			[4, 20],
		]),
	);
	const ten = converted.values.get(10)!;
	assert.equal(ten.value, 150);
	assert.equal(ten.inputs, 2);
	assert.ok(isRegrouped(ten));
	const twelve = converted.values.get(12)!;
	assert.equal(twelve.value, 80);
	assert.equal(twelve.atRisk, 15);
	assert.deepEqual([...twelve.splits], [7]);
	assert.ok(!isRegrouped(twelve));
	assert.equal(
		[...converted.values.values()].reduce((sum, v) => sum + v.value, 0),
		250,
	);
	assert.equal(converted.gaps.size, 0);
});

test("a target with a missing or blocked feeder gets a reason, never a partial sum", () => {
	const converted = convertThroughSteps(
		[
			step(
				{ 1: [{ to: 10 }], 2: [{ to: 10 }], 3: [{ to: 11 }] },
				{ 4: { reason: "best-fit-straddler", targets: [11, 12] } },
			),
		],
		startValues([
			[1, 100],
			[3, 5],
			[4, 9],
			[99, 1],
		]),
	);
	assert.equal(converted.values.size, 0);
	assert.deepEqual([...converted.gaps].sort(), [
		[10, "missing-input"],
		[11, "best-fit-straddler"],
		[12, "best-fit-straddler"],
	]);
	// A value on an area no edge leaves is reported, not dropped silently.
	assert.deepEqual(converted.uncarried, [[99]]);
});

test("a gap and the risk of a split are carried through a later step", () => {
	const first = step({
		1: [
			{ to: 10, weight: 0.5, risk: 0.25 },
			{ to: 11, weight: 0.5, risk: 0.25 },
		],
		2: [{ to: 12 }],
		3: [{ to: 12 }],
	});
	const second = step({
		10: [{ to: 20, crosswalk: 8 }],
		11: [{ to: 20, crosswalk: 8 }],
		12: [{ to: 21, crosswalk: 8 }],
	});
	const converted = convertThroughSteps(
		[first, second],
		startValues([
			[1, 40],
			[2, 6],
		]),
	);
	// Both halves of the split end in one area: the value is whole again,
	// but it is still marked as having passed through a split.
	const twenty = converted.values.get(20)!;
	assert.equal(twenty.value, 40);
	assert.equal(twenty.atRisk, 20);
	assert.deepEqual([...twenty.splits], [7]);
	assert.deepEqual([...converted.gaps], [[21, "missing-input"]]);
});

test("bounds widen with the amount at risk, and a pruned pair lowers only the lower bound", () => {
	assert.deepEqual(boundsOf({ value: 100, atRisk: 10, pruned: 0 }, 1.5), {
		lower: 85,
		upper: 115,
	});
	assert.deepEqual(boundsOf({ value: 100, atRisk: 10, pruned: 4 }, 1.5), {
		lower: 81,
		upper: 115,
	});
	assert.equal(boundsOf({ value: 3, atRisk: 10, pruned: 0 }, 1).lower, 0);
});
