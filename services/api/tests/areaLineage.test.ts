import assert from "node:assert/strict";
import test from "node:test";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "../src/crosswalkInventory";
import { createLookupResolver } from "../../../pipeline/src/lookupResolver";
import { createGeographyResolver } from "../src/geographyResolver";
import { createRelationshipPathIndex } from "../src/relationshipPaths";
import { compileRelationshipPaths } from "../../../pipeline/src/relationshipPaths";
import {
	compileAreaLineage,
	followLineage,
	followLineageFromCode,
	isRealigned,
	listedReleases,
	type AreaLineage,
} from "@uk-data-atlas/geography";

const artifact = (
	id: string,
	method: "official-lookup" | "extent-continuity",
	pairs: Array<[string, string[]]>,
) =>
	({
		schemaVersion: 1,
		contentHash: `sha256:${id}`,
		id,
		method,
		quality:
			method === "official-lookup" ? "publisher-supplied" : "derived",
		relationshipPurpose: "identity",
		weighting: { status: "not-applicable" },
		validation: { continuity: { realigned: [] } },
		from: { geography: "ward", boundaryRelease: "1" },
		to: { geography: "ward", boundaryRelease: "2" },
		records: pairs.map(([source, targets]) => ({
			source: { code: source, labels: [source] },
			targets: targets.map((code) => ({ code, labels: [code] })),
		})),
	}) as unknown as CrosswalkArtifact;

// ONS's history lists only what changed: X renumbered X2, A and B merged into
// M, and S split into S1 and S2. The derived crosswalk carries U on, and pairs
// S with S1, whose extent it cannot tell from S's.
const artifacts = [
	artifact("history", "official-lookup", [
		["X", ["X2"]],
		["A", ["M"]],
		["B", ["M"]],
		["S", ["S1", "S2"]],
	]),
	artifact("continuity", "extent-continuity", [
		["U", ["U"]],
		["S", ["S1"]],
	]),
];

const inventory: CrosswalkInventory = {
	schemaVersion: 1,
	contentHash: "sha256:crosswalks",
	crosswalks: artifacts.map((crosswalk) => ({
		id: crosswalk.id,
		from: crosswalk.from,
		to: crosswalk.to,
		method: crosswalk.method,
		quality: crosswalk.quality,
		relationshipPurpose: "identity",
		weighting: crosswalk.weighting,
		recordCount: crosswalk.records.length,
		artifact: `crosswalks/${crosswalk.id}.json`,
		contentHash: crosswalk.contentHash,
	})),
};

const resolver = createGeographyResolver({
	crosswalkLookup: new Map(
		artifacts.map((crosswalk) => [crosswalk.id, crosswalk]),
	),
	relationshipPathIndex: createRelationshipPathIndex(
		compileRelationshipPaths(inventory),
	),
});

test("pipeline lookup resolver agrees with the API on translation and release lookups", () => {
	const areaLookup = new Map([
		["ward/1", new Map()],
		["ward/2", new Map()],
	]);
	const crosswalkLookup = new Map(
		artifacts.map((crosswalk) => [crosswalk.id, crosswalk]),
	);
	const relationshipPathIndex = createRelationshipPathIndex(
		compileRelationshipPaths(inventory),
	);
	const inputs = {
		areaLookup,
		crosswalkInventory: inventory,
		crosswalkLookup,
		relationshipPathIndex,
	};
	const api = createGeographyResolver(inputs);
	const pipeline = createLookupResolver(inputs);
	for (const release of ["1", "2", "missing"]) {
		assert.equal(
			pipeline.hasAreaRelease("ward", release),
			api.hasAreaRelease("ward", release),
		);
		assert.deepEqual(
			pipeline.areaCodes("ward", release),
			api.areaCodes("ward", release),
		);
	}
	assert.deepEqual(pipeline.crosswalkSummaries(), api.crosswalkSummaries());
	for (const id of ["history", "continuity", "missing"])
		assert.deepEqual(pipeline.crosswalk(id), api.crosswalk(id));
	for (const code of ["X", "U", "A", "S", "missing"]) {
		const source = { geography: "ward", boundaryRelease: "1", code };
		const target = { geography: "ward", boundaryRelease: "2" };
		assert.deepEqual(
			pipeline.sameArea(source, target),
			api.sameArea(source, target),
		);
		assert.deepEqual(
			pipeline.successorArea(source, target),
			api.successorArea(source, target),
		);
	}
});

const same = (code: string, from: string, to: string) =>
	resolver.sameArea(
		{ geography: "ward", boundaryRelease: from, code },
		{ geography: "ward", boundaryRelease: to },
	)?.code;

test("hears a publisher's lookup first, and accepts only a one-to-one answer", () => {
	assert.equal(same("X", "1", "2"), "X2");
	assert.equal(same("X2", "2", "1"), "X");
	// Where the history is silent, the derived crosswalk answers.
	assert.equal(same("U", "1", "2"), "U");
	// A merged successor holds more than A, so it is not the same area.
	assert.equal(same("A", "1", "2"), undefined);
	assert.equal(same("M", "2", "1"), undefined);
	// The history's split stands over the derived match.
	assert.equal(same("S", "1", "2"), undefined);
	assert.equal(same("S1", "2", "1"), undefined);
});

// Three releases: P is renumbered Q in 2, redrawn by a street, so Q is its
// realigned successor; Q ends in 3, though a lookup joining 1 and 3 directly
// says P is the same area as N there; K keeps its code throughout; R ends in
// 2.
const answers: Record<string, Record<string, string>> = {
	"1>2": { K: "K", P: "Q" },
	"2>1": { K: "K", Q: "P" },
	"2>3": { K: "K" },
	"3>2": { K: "K" },
	"1>3": { K: "K", P: "N" },
	"3>1": { K: "K", N: "P" },
};
const lineage: AreaLineage = compileAreaLineage(
	"ward",
	["1", "2", "3"],
	(release) =>
		({ "1": ["K", "P", "R"], "2": ["K", "Q"], "3": ["K", "N"] })[release]!,
	(code, from, to) => {
		const answer = answers[`${from}>${to}`]![code];
		return answer === undefined
			? undefined
			: {
					code: answer,
					realigned:
						(code === "P" && to === "2") ||
						(code === "Q" && to === "1"),
				};
	},
);

test("stores only the codes that do not carry on under their own code", () => {
	assert.deepEqual(lineage.steps, [
		{ forward: { P: "Q", R: null }, backward: { Q: "P" } },
		{ forward: { Q: null }, backward: { N: null } },
	]);
	// Only where the direct answer differs from what the steps compose to.
	assert.deepEqual(lineage.overrides, {
		"1>3": { P: "N" },
		"3>1": { N: "P" },
	});
	// The realigned step is listed apart; the direct lookup is not realigned.
	assert.deepEqual(lineage.realigned, {
		steps: [
			{ forward: ["P"], backward: ["Q"] },
			{ forward: [], backward: [] },
		],
		overrides: {},
	});
});

test("says which answers lead to a realigned successor", () => {
	assert.equal(isRealigned(lineage, "P", "1", "2"), true);
	assert.equal(isRealigned(lineage, "Q", "2", "1"), true);
	assert.equal(isRealigned(lineage, "P", "1", "3"), false);
	assert.equal(isRealigned(lineage, "K", "1", "3"), false);
});

test("follows an area release by release, in either direction", () => {
	assert.equal(followLineage(lineage, "K", "1", "3"), "K");
	assert.equal(followLineage(lineage, "K", "3", "1"), "K");
	assert.equal(followLineage(lineage, "P", "1", "2"), "Q");
	assert.equal(followLineage(lineage, "Q", "2", "1"), "P");
	assert.equal(followLineage(lineage, "P", "1", "3"), "N");
	assert.equal(followLineage(lineage, "N", "3", "1"), "P");
	assert.equal(followLineage(lineage, "Q", "2", "3"), undefined);
	assert.equal(followLineage(lineage, "R", "1", "3"), undefined);
	assert.equal(followLineage(lineage, "R", "1", "1"), "R");
	assert.equal(followLineage(lineage, "K", "1", "9"), undefined);
});

test("follows a code whose release is not known from the nearest release that lists it", () => {
	const listed = listedReleases(lineage);
	assert.deepEqual(listed.get("P"), [0]);
	assert.deepEqual(listed.get("Q"), [1]);
	assert.equal(listed.has("K"), false);
	assert.equal(followLineageFromCode(lineage, listed, "K", "3"), "K");
	assert.equal(followLineageFromCode(lineage, listed, "Q", "1"), "P");
	assert.equal(followLineageFromCode(lineage, listed, "Q", "3"), undefined);
	assert.equal(followLineageFromCode(lineage, listed, "P", "3"), "N");
	assert.equal(followLineageFromCode(lineage, listed, "K", "9"), undefined);
});
