import assert from "node:assert/strict";
import test from "node:test";
import type { CrosswalkArtifact } from "../src/crosswalkInventory";
import type { RelationshipPath } from "../src/relationshipPaths";
import { createRelationshipPathIndex } from "../src/relationshipPaths";
import {
	buildStepTargets,
	buildTranslationSteps,
	CrosswalkTranslator,
	directTranslationPaths,
	executeTranslationPath,
	rankTranslationPaths,
	type TranslationTarget,
} from "../src/resolver/translation";

type Endpoint = { geography: string; boundaryRelease: string };

const endpoint = (geography: string): Endpoint => ({
	geography,
	boundaryRelease: "2025",
});

const validation = {
	sourceNameConflicts: [],
	endpoints: {
		from: { status: "not-available", reason: "Fixture." },
		to: { status: "not-available", reason: "Fixture." },
	},
};

/** Translation reads only identity, endpoints, method and records. */
const lookupCrosswalk = (
	id: string,
	from: string,
	to: string,
	records: Array<[string, string[]]>,
	extra: Partial<CrosswalkArtifact> = {},
): CrosswalkArtifact =>
	({
		schemaVersion: 1,
		contentHash: `sha256:${id}`,
		id,
		method: "official-lookup",
		quality: "publisher-supplied",
		weighting: { status: "not-provided" },
		from: endpoint(from),
		to: endpoint(to),
		provenance: { input: `${id}.csv`, inputHash: `sha256:${id}-input` },
		validation,
		records: records.map(([source, targets]) => ({
			source: { code: source, labels: [`${source} label`] },
			targets: targets.map((code) => ({ code, labels: [`${code} label`] })),
		})),
		...extra,
	}) as CrosswalkArtifact;

type OverlapRecord = {
	source: string;
	targets: Array<{
		code: string;
		weight: number;
		sourceShare: number;
		targetShare: number;
	}>;
};

const overlapCrosswalk = (
	id: string,
	from: string,
	to: string,
	records: OverlapRecord[],
): CrosswalkArtifact =>
	({
		schemaVersion: 1,
		contentHash: `sha256:${id}`,
		id,
		method: "area-overlap",
		quality: "derived",
		weighting: { status: "area" },
		from: endpoint(from),
		to: endpoint(to),
		provenance: { inputs: [] },
		validation,
		records: records.map(({ source, targets }) => ({
			source: { code: source, labels: [`${source} label`], areaM2: 100, coverage: 1 },
			targets: targets.map((target) => ({
				...target,
				labels: [`${target.code} label`],
				overlapAreaM2: 100 * target.sourceShare,
			})),
		})),
	}) as unknown as CrosswalkArtifact;

const path = (
	id: string,
	purpose: RelationshipPath["purpose"],
	steps: Array<[CrosswalkArtifact, "forward" | "reverse"]>,
	overrides: Partial<RelationshipPath> = {},
): RelationshipPath => {
	const [first] = steps[0]!;
	const [last, lastDirection] = steps.at(-1)!;
	return {
		id,
		purpose,
		from: steps[0]![1] === "forward" ? first.from : first.to,
		to: lastDirection === "forward" ? last.to : last.from,
		quality: steps.every(([artifact]) => artifact.quality === "publisher-supplied")
			? "publisher-supplied"
			: "derived",
		origin: "declared",
		steps: steps.map(([artifact, direction]) => ({
			crosswalkId: artifact.id,
			direction,
			method: artifact.method,
			purpose,
		})),
		...overrides,
	};
};

const codesAndWeights = (targets: TranslationTarget[]) =>
	targets.map((target) => [
		target.code,
		"weight" in target ? Math.round(target.weight * 1e9) / 1e9 : undefined,
	]);

test("indexes a forward step by source code with its published targets", () => {
	const crosswalk = lookupCrosswalk("a-b", "a", "b", [
		["A1", ["B1"]],
		["A2", ["B1", "B2"]],
	]);
	const steps = buildTranslationSteps(crosswalk, "forward");

	assert.deepEqual([...steps.keys()], ["A1", "A2"]);
	assert.deepEqual(
		steps.get("A2")!.targets.map((target) => target.code),
		["B1", "B2"],
	);
	assert.equal(steps.get("A2")!.sourceCoverage, undefined);
});

test("reverses a lookup step by collecting every source that names a target", () => {
	const crosswalk = lookupCrosswalk("a-b", "a", "b", [
		["A1", ["B1"]],
		["A2", ["B1", "B2"]],
	]);
	const steps = buildTranslationSteps(crosswalk, "reverse");

	assert.deepEqual(
		steps.get("B1")!.targets.map((target) => target.code),
		["A1", "A2"],
	);
	assert.deepEqual(steps.get("B1")!.source, {
		code: "B1",
		labels: ["B1 label"],
	});
});

test("normalises a reversed overlap to the share of the queried area its sources cover", () => {
	// B1 is 30% covered by A1 and 50% by A2; 20% has no published source.
	const crosswalk = overlapCrosswalk("a-b", "a", "b", [
		{ source: "A1", targets: [{ code: "B1", weight: 1, sourceShare: 1, targetShare: 0.3 }] },
		{
			source: "A2",
			targets: [
				{ code: "B1", weight: 0.5, sourceShare: 0.5, targetShare: 0.5 },
				{ code: "B2", weight: 0.5, sourceShare: 0.5, targetShare: 1 },
			],
		},
	]);
	const step = buildTranslationSteps(crosswalk, "reverse").get("B1")!;

	assert.equal(step.sourceCoverage, 0.8);
	assert.deepEqual(codesAndWeights(step.targets), [
		["A1", 0.375],
		["A2", 0.625],
	]);
	// Shares are restated from the queried area's side of the overlap.
	const a2 = step.targets[1] as TranslationTarget & {
		sourceShare: number;
		targetShare: number;
	};
	assert.equal(a2.sourceShare, 0.5);
	assert.equal(a2.targetShare, 0.5);
});

test("skips a reversed overlap target with no covered share", () => {
	const crosswalk = overlapCrosswalk("a-b", "a", "b", [
		{ source: "A1", targets: [{ code: "B1", weight: 1, sourceShare: 1, targetShare: 0 }] },
	]);

	assert.equal(buildTranslationSteps(crosswalk, "reverse").has("B1"), false);
});

test("lists the codes each step direction reaches", () => {
	const crosswalk = lookupCrosswalk("a-b", "a", "b", [
		["A1", ["B1"]],
		["A2", ["B1", "B2"]],
	]);

	assert.deepEqual(
		Object.fromEntries(buildStepTargets(crosswalk, "forward")),
		{ A1: ["B1"], A2: ["B1", "B2"] },
	);
	assert.deepEqual(
		Object.fromEntries(buildStepTargets(crosswalk, "reverse")),
		{ B1: ["A1", "A2"], B2: ["A2"] },
	);
});

test("multiplies apportion weights along a path and sums them where routes meet", () => {
	// A1 splits 60/40 over X and Y; X lands wholly in T, Y splits evenly over T and U.
	const first = overlapCrosswalk("a-m", "a", "m", [
		{
			source: "A1",
			targets: [
				{ code: "X", weight: 0.6, sourceShare: 0.6, targetShare: 1 },
				{ code: "Y", weight: 0.4, sourceShare: 0.4, targetShare: 1 },
			],
		},
	]);
	const second = overlapCrosswalk("m-t", "m", "t", [
		{ source: "X", targets: [{ code: "T", weight: 1, sourceShare: 1, targetShare: 0.5 }] },
		{
			source: "Y",
			targets: [
				{ code: "T", weight: 0.5, sourceShare: 0.5, targetShare: 0.5 },
				{ code: "U", weight: 0.5, sourceShare: 0.5, targetShare: 1 },
			],
		},
	]);
	const route = path("a-t", "apportion", [
		[first, "forward"],
		[second, "forward"],
	]);
	const steps = new Map([
		[first.id, buildTranslationSteps(first, "forward")],
		[second.id, buildTranslationSteps(second, "forward")],
	]);
	const translation = executeTranslationPath(route, "A1", (step) =>
		steps.get(step.crosswalkId),
	)!;

	assert.deepEqual(codesAndWeights(translation.targets), [
		["T", 0.8],
		["U", 0.2],
	]);
	const total = translation.targets.reduce(
		(sum, target) => sum + ("weight" in target ? target.weight : 0),
		0,
	);
	assert.ok(Math.abs(total - 1) < 1e-9);
});

test("merges labels without inventing weights on a membership path", () => {
	const first = lookupCrosswalk("a-m", "a", "m", [["A1", ["X", "Y"]]]);
	const second = lookupCrosswalk("m-t", "m", "t", [
		["X", ["T"]],
		["Y", ["T"]],
	]);
	const route = path("a-t", "membership", [
		[first, "forward"],
		[second, "forward"],
	]);
	const steps = new Map([
		[first.id, buildTranslationSteps(first, "forward")],
		[second.id, buildTranslationSteps(second, "forward")],
	]);
	const translation = executeTranslationPath(route, "A1", (step) =>
		steps.get(step.crosswalkId),
	)!;

	assert.deepEqual(translation.targets, [{ code: "T", labels: ["T label"] }]);
	assert.deepEqual(translation.source, { code: "A1", labels: ["A1 label"] });
});

test("keeps the crosswalk shape and source coverage on a direct path", () => {
	const crosswalk = overlapCrosswalk("a-b", "a", "b", [
		{ source: "A1", targets: [{ code: "B1", weight: 1, sourceShare: 1, targetShare: 0.4 }] },
	]);
	const route = path("b-a", "apportion", [[crosswalk, "reverse"]]);
	const steps = buildTranslationSteps(crosswalk, "reverse");
	const translation = executeTranslationPath(route, "B1", () => steps)!;

	assert.equal(translation.sourceCoverage, 0.4);
	assert.deepEqual(codesAndWeights(translation.targets), [["A1", 1]]);
});

test("has no result when the area, an artifact, or every target drops out", () => {
	const first = lookupCrosswalk("a-m", "a", "m", [["A1", ["X"]]]);
	const second = lookupCrosswalk("m-t", "m", "t", [["Y", ["T"]]]);
	const route = path("a-t", "membership", [
		[first, "forward"],
		[second, "forward"],
	]);
	const steps = new Map([
		[first.id, buildTranslationSteps(first, "forward")],
		[second.id, buildTranslationSteps(second, "forward")],
	]);
	const stepsFor = (step: RelationshipPath["steps"][number]) =>
		steps.get(step.crosswalkId);

	assert.equal(executeTranslationPath(route, "A2", stepsFor), undefined);
	assert.equal(executeTranslationPath(route, "A1", stepsFor), undefined);
	assert.equal(
		executeTranslationPath(route, "A1", (step) =>
			step.crosswalkId === first.id ? steps.get(first.id) : undefined,
		),
		undefined,
	);
});

test("ranks single crosswalks, then reviewed, then discovered, then evidence and length", () => {
	const crosswalk = lookupCrosswalk("a-b", "a", "b", []);
	const derived = overlapCrosswalk("b-c", "b", "c", []);
	const ranked = rankTranslationPaths([
		path("discovered", "membership", [[crosswalk, "forward"]], { origin: "discovered" }),
		path("declared-long", "membership", [
			[crosswalk, "forward"],
			[crosswalk, "forward"],
		]),
		path("declared-derived", "membership", [[derived, "forward"]]),
		path("declared-short", "membership", [[crosswalk, "forward"]]),
		path("crosswalk", "membership", [[crosswalk, "forward"]], { origin: "crosswalk" }),
	]);

	assert.deepEqual(
		ranked.map((candidate) => candidate.id),
		["crosswalk", "declared-short", "declared-long", "declared-derived", "discovered"],
	);
});

test("builds direct fallback paths in either direction for the requested purpose", () => {
	const lookup = lookupCrosswalk("a-b", "a", "b", []);
	const containment = lookupCrosswalk("a-c", "a", "c", [], {
		method: "geometric-containment",
		quality: "derived",
	} as Partial<CrosswalkArtifact>);

	assert.deepEqual(
		directTranslationPaths([lookup], endpoint("b"), endpoint("a"), "identity").map(
			(candidate) => candidate.id,
		),
		["a-b/reverse/identity"],
	);
	assert.deepEqual(
		directTranslationPaths([lookup], endpoint("a"), endpoint("b"), "membership"),
		[],
	);
	assert.deepEqual(
		directTranslationPaths([containment], endpoint("a"), endpoint("c"), "membership").map(
			(candidate) => candidate.id,
		),
		["a-c/forward/membership"],
	);
});

test("prefers published paths over the direct crosswalk fallback", () => {
	const direct = lookupCrosswalk("a-b", "a", "b", [["A1", ["B1"]]], {
		relationshipPurpose: "membership",
	});
	const viaM = lookupCrosswalk("a-m", "a", "m", [["A1", ["M1"]]], {
		relationshipPurpose: "membership",
	});
	const mToB = lookupCrosswalk("m-b", "m", "b", [["M1", ["B2"]]], {
		relationshipPurpose: "membership",
	});
	const published = path("a-m-b", "membership", [
		[viaM, "forward"],
		[mToB, "forward"],
	]);
	const crosswalkLookup = new Map(
		[direct, viaM, mToB].map((crosswalk) => [crosswalk.id, crosswalk]),
	);
	const source = { ...endpoint("a"), code: "A1" };

	const fallbackOnly = new CrosswalkTranslator({ crosswalkLookup });
	assert.deepEqual(
		fallbackOnly
			.translateArea(source, endpoint("b"), "membership")
			.map(({ path: used, targets }) => [used.id, targets.map((target) => target.code)]),
		[["a-b/forward/membership", ["B1"]]],
	);

	const withPaths = new CrosswalkTranslator({
		crosswalkLookup,
		relationshipPathIndex: createRelationshipPathIndex({
			schemaVersion: 1,
			contentHash: "sha256:paths",
			crosswalkInventoryHash: "sha256:crosswalks",
			paths: [published],
		}),
	});
	assert.deepEqual(
		withPaths
			.translateArea(source, endpoint("b"), "membership")
			.map(({ path: used, targets }) => [used.id, targets.map((target) => target.code)]),
		[["a-m-b", ["B2"]]],
	);
});

test("counts the source areas that reach the target through every step", () => {
	const first = lookupCrosswalk("a-m", "a", "m", [
		["A1", ["M1"]],
		["A2", ["M2"]],
		["A3", ["M3"]],
	]);
	const second = lookupCrosswalk("m-t", "m", "t", [
		["M1", ["T1"]],
		["M2", ["T1"]],
	]);
	const route = path("a-t", "membership", [
		[first, "forward"],
		[second, "forward"],
	]);
	const translator = new CrosswalkTranslator({
		crosswalkLookup: new Map([
			[first.id, first],
			[second.id, second],
		]),
	});

	assert.equal(translator.pathReach(route, endpoint("a")), 2);
});
