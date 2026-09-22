import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "../src/crosswalkInventory";
import { createGeographyResolver } from "../src/geographyResolver";
import {
	compileRelationshipPaths,
	createRelationshipPathIndex,
	crosswalkShape,
} from "../src/relationshipPaths";

// Wards W1 to W3 nest in authority A of release 1. Authority A keeps its code
// into release 2, as does B, which no ward reaches. Only W1 and W2 keep their
// codes into ward release 2, so a path from ward 2 upward carries two wards.
const areaLookup = createAreaLookup(
	[
		["ward", "1", ["W1", "W2", "W3"]],
		["ward", "2", ["W1", "W2", "W3"]],
		["authority", "1", ["A", "B"]],
		["authority", "2", ["A", "B"]],
	].map(([geography, boundaryRelease, codes]) => ({
		schemaVersion: 1 as const,
		contentHash: `sha256:${geography}-${boundaryRelease}`,
		geography: geography as string,
		boundaryRelease: boundaryRelease as string,
		codeProperty: "CD",
		nameProperty: "NM",
		areas: (codes as string[]).map((code) => ({ code, name: code })),
	})),
);

const artifact = (
	id: string,
	from: [string, string],
	to: [string, string],
	method: CrosswalkArtifact["method"],
	quality: CrosswalkArtifact["quality"],
	pairs: Array<[string, string]>,
) =>
	({
		schemaVersion: 1,
		contentHash: `sha256:${id}`,
		id,
		method,
		quality,
		...(method === "same-code-continuity"
			? { relationshipPurpose: "identity" }
			: {}),
		weighting: { status: "not-applicable" },
		from: { geography: from[0], boundaryRelease: from[1] },
		to: { geography: to[0], boundaryRelease: to[1] },
		records: pairs.map(([source, target]) => ({
			source: { code: source, labels: [source] },
			targets: [{ code: target, labels: [target] }],
		})),
	}) as unknown as CrosswalkArtifact;

const artifacts = [
	artifact(
		"wards",
		["ward", "2"],
		["ward", "1"],
		"same-code-continuity",
		"derived",
		[
			["W1", "W1"],
			["W2", "W2"],
		],
	),
	artifact(
		"ward-authority",
		["ward", "1"],
		["authority", "1"],
		"clean-containment",
		"publisher-supplied",
		[
			["W1", "A"],
			["W2", "A"],
			["W3", "A"],
		],
	),
	artifact(
		"authorities",
		["authority", "1"],
		["authority", "2"],
		"same-code-continuity",
		"derived",
		[
			["A", "A"],
			["B", "B"],
		],
	),
];

const crosswalkInventory: CrosswalkInventory = {
	schemaVersion: 1,
	contentHash: "sha256:crosswalks",
	crosswalks: artifacts.map((crosswalk) => ({
		id: crosswalk.id,
		from: crosswalk.from,
		to: crosswalk.to,
		method: crosswalk.method,
		quality: crosswalk.quality,
		...(crosswalk.relationshipPurpose
			? { relationshipPurpose: crosswalk.relationshipPurpose }
			: {}),
		weighting: crosswalk.weighting,
		recordCount: crosswalk.records.length,
		artifact: `crosswalks/${crosswalk.id}.json`,
		contentHash: crosswalk.contentHash,
	})),
};

const resolver = createGeographyResolver({
	areaLookup,
	crosswalkLookup: new Map(
		artifacts.map((crosswalk) => [crosswalk.id, crosswalk]),
	),
	relationshipPathIndex: createRelationshipPathIndex(
		compileRelationshipPaths(crosswalkInventory, [], {
			shapes: new Map(
				artifacts.map((crosswalk) => [
					crosswalk.id,
					crosswalkShape(crosswalk),
				]),
			),
			maximumSteps: 8,
		}),
	),
});

test("reports a composed path's coverage end to end, not by its first step", () => {
	const capability = resolver.relationshipCapability(
		{ geography: "ward", boundaryRelease: "2" },
		{ geography: "authority", boundaryRelease: "2" },
		"membership",
	);
	assert.equal(capability.status, "partial");
	const [path] = capability.paths;
	assert.equal(path?.origin, "discovered");
	assert.deepEqual(
		{
			status: path?.coverage.status,
			mappedSourceAreaCount: path?.coverage.mappedSourceAreaCount,
			sourceAreaCount: path?.coverage.sourceAreaCount,
		},
		{ status: "partial", mappedSourceAreaCount: 2, sourceAreaCount: 3 },
	);
	// The middle step on its own covers every ward of its release.
	assert.equal(path?.coverage.steps[1]?.status, "complete");
});

test("caps a discovered path's trust at derived and says why", () => {
	const capability = resolver.relationshipCapability(
		{ geography: "ward", boundaryRelease: "1" },
		{ geography: "authority", boundaryRelease: "2" },
		"membership",
	);
	const [path] = capability.paths;
	assert.equal(path?.coverage.status, "complete");
	assert.equal(path?.trust.level, "derived");
	assert.match(
		path?.trust.reasons[0] ?? "",
		/path search composed this path/,
	);
});
