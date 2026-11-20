import assert from "node:assert/strict";
import { test } from "vitest";
import { composeChain } from "../../src/conversion/chains.ts";
import {
	convertThroughSteps,
	startValues,
} from "../../src/conversion/convert.ts";
import type {
	BlockReason,
	Step,
	StepEdge,
} from "../../src/conversion/crosswalkSteps.ts";
import type { Hop, Router } from "../../src/conversion/routes.ts";
import { splitRisk } from "../../src/conversion/crosswalkSteps.ts";

const near = (actual: number, expected: number) =>
	assert.ok(
		Math.abs(actual - expected) < 1e-12,
		`${actual} is not ${expected}`,
	);

const edge = (to: number, weight = 1, crosswalk = 1): StepEdge => ({
	to,
	weight,
	risk: weight === 1 ? 0 : splitRisk(weight),
	pruned: 0,
	crosswalk,
});

const step = (
	fromRelease: number,
	toRelease: number,
	edges: Record<number, StepEdge[]>,
	blocked: Record<number, { reason: BlockReason; targets: number[] }> = {},
): Step => {
	const feeders = new Map<number, number[]>();
	const feed = (source: number, target: number) =>
		feeders.set(target, [...(feeders.get(target) ?? []), source]);
	for (const [source, list] of Object.entries(edges))
		for (const item of list) feed(Number(source), item.to);
	for (const [source, entry] of Object.entries(blocked))
		for (const target of entry.targets) feed(Number(source), target);
	return {
		fromRelease,
		toRelease,
		crosswalks: [],
		reversed: false,
		edges: new Map(
			Object.entries(edges).map(([source, list]) => [
				Number(source),
				list,
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

/** A router that hands back the steps given, one per hop of the route. */
const routed = (steps: Step[]) => {
	const route: Hop[] = steps.map((one, index) => ({
		fromRelease: one.fromRelease,
		toRelease: one.toRelease,
		crosswalks: [index],
		reversed: false,
		exact: false,
	}));
	const byCrosswalk = new Map(
		route.map((hop, index) => [hop.crosswalks[0]!, steps[index]!]),
	);
	const router = {
		step: (hop: Hop) => byCrosswalk.get(hop.crosswalks[0]!)!,
	} as unknown as Router;
	return { router, route };
};

// Release 1 has areas 1 (A), 2 (D); release 2 has 10 (B), 11 (C); release 3
// has 20 (X), 21 (Y). A splits a quarter to B and three quarters to C, D is
// all of C, B is all of X, and C splits evenly between X and Y.
const first = step(
	1,
	2,
	{ 1: [edge(10, 0.25, 7), edge(11, 0.75, 7)], 2: [edge(11, 1, 8)] },
	{},
);
const second = step(2, 3, {
	10: [edge(20, 1, 9)],
	11: [edge(20, 0.5, 9), edge(21, 0.5, 9)],
});

test("weights multiply along a chain and add across branches", () => {
	const { router, route } = routed([first, second]);
	const chain = composeChain(router, route, "population", [1, 2]);
	const weight = (from: number, to: number) =>
		chain.edges.find((e) => e.from === from && e.to === to)?.weight;
	// A reaches X by B (0.25 * 1) and by C (0.75 * 0.5), Y by C alone.
	near(weight(1, 20)!, 0.25 + 0.75 * 0.5);
	near(weight(1, 21)!, 0.75 * 0.5);
	// D is carried whole to C, then half each way.
	near(weight(2, 20)!, 0.5);
	near(weight(2, 21)!, 0.5);
	assert.equal(chain.edges.length, 4);
	assert.deepEqual(chain.gaps, []);
	assert.equal(chain.fromRelease, 1);
	assert.equal(chain.toRelease, 3);
});

test("a chain splits the weight of every start area completely", () => {
	const { router, route } = routed([first, second]);
	const chain = composeChain(router, route, "population", [1, 2]);
	for (const from of [1, 2])
		near(
			chain.edges
				.filter((e) => e.from === from)
				.reduce((sum, e) => sum + e.weight, 0),
			1,
		);
});

test("error adds up along a chain as it does through the steps", () => {
	const { router, route } = routed([first, second]);
	const chain = composeChain(router, route, "population", [1, 2]);
	const toX = chain.edges.find((e) => e.from === 1 && e.to === 20)!;
	// The quarter that went to B and three quarters to C each risk their own
	// split (0.25 * 0.75 per unit), then C's half is at risk of its own again.
	const atB = splitRisk(0.25);
	const atC = splitRisk(0.75);
	near(toX.atRisk, atB * 1 + (atC * 0.5 + 0.75 * splitRisk(0.5)));
	near(toX.pruned, 0);
	// The mass that took a splitting edge at any step, counted at each step as
	// the converter does, so it can pass the weight and is clamped when read.
	near(toX.estimated, 0.25 + (0.75 * 0.5 + 0.75 * 0.5));
	assert.deepEqual([...toX.splits].sort(), [7, 9]);
	// D took only an exact edge, then a split.
	const fromD = chain.edges.find((e) => e.from === 2 && e.to === 20)!;
	near(fromD.atRisk, 0.5 * 0.5 * 1);
	assert.deepEqual([...fromD.splits], [9]);
});

test("a pruned pair is carried as error that errs one way", () => {
	const pruned: StepEdge = {
		to: 10,
		weight: 1,
		risk: 0,
		pruned: 0.03,
		crosswalk: 5,
	};
	const { router, route } = routed([
		step(1, 2, { 1: [pruned] }),
		step(2, 3, { 10: [edge(20, 1, 6)] }),
	]);
	const [only] = composeChain(router, route, "postcodes", [1]).edges;
	near(only!.weight, 1);
	near(only!.pruned, 0.03);
	near(only!.atRisk, 0);
	near(only!.estimated, 1);
	assert.deepEqual([...only!.splits], [5]);
});

test("a chain agrees with converting a value through the same steps", () => {
	const { router, route } = routed([first, second]);
	const starts = [1, 2];
	const chain = composeChain(router, route, "population", starts);
	const values = new Map([
		[1, 1000],
		[2, 40],
	]);
	const converted = convertThroughSteps([first, second], startValues(values));
	for (const to of [20, 21]) {
		const own = chain.edges.filter((e) => e.to === to);
		const sum = (pick: (e: (typeof own)[number]) => number) =>
			own.reduce((total, e) => total + values.get(e.from)! * pick(e), 0);
		const carried = converted.values.get(to)!;
		near(
			sum((e) => e.weight),
			carried.value,
		);
		near(
			sum((e) => e.atRisk),
			carried.atRisk,
		);
		near(
			sum((e) => e.pruned),
			carried.pruned,
		);
		near(
			sum((e) => e.estimated),
			carried.estimated,
		);
		assert.ok(own.every((e) => e.complete));
	}
});

test("a blocked area has no edge down that branch, and spoils its targets", () => {
	// E is blocked in the first step, and was to feed C.
	const blocked = step(
		1,
		2,
		{ 1: [edge(10, 0.25, 7), edge(11, 0.75, 7)] },
		{ 3: { reason: "no-weight", targets: [11] } },
	);
	const { router, route } = routed([blocked, second]);
	const chain = composeChain(router, route, "population", [1, 3]);
	assert.deepEqual(chain.gaps, [{ from: 3, reason: "no-weight" }]);
	assert.ok(chain.edges.every((e) => e.from === 1));
	// C cannot be completed without E, so what A sends through C is short on
	// Y and X, but B is whole: nothing else feeds it.
	const complete = (to: number) =>
		chain.edges.find((e) => e.to === to)!.complete;
	assert.equal(complete(21), false);
	assert.equal(complete(20), false);
});

test("an area in no crosswalk of a later hop is a gap, whatever the first hop did", () => {
	const lonely = step(2, 3, { 10: [edge(20, 1, 9)] });
	const { router, route } = routed([first, lonely]);
	const chain = composeChain(router, route, "population", [1]);
	// A's three quarters reach C, which the second hop has no edge for.
	assert.deepEqual(chain.gaps, [{ from: 1, reason: "not-in-crosswalk" }]);
	const [only] = chain.edges;
	near(only!.weight, 0.25);
});
