import assert from "node:assert/strict";
import test from "node:test";
import {
	createAreaRelationshipIndex,
	LazyAreaRelationshipIndex,
} from "../src/areaRelationships";
import {
	selectCrosswalks,
	type CrosswalkLookup,
} from "../src/resolver/translation";
import type {
	AreaOverlapCrosswalkArtifact,
	PropertyCrosswalkArtifact,
} from "../src/crosswalkInventory";

const endpoints = {
	from: { status: "verified", availableAreaCount: 1, referencedCodeCount: 1 },
	to: { status: "verified", availableAreaCount: 1, referencedCodeCount: 1 },
} as const;

const containment: PropertyCrosswalkArtifact = {
	schemaVersion: 1,
	contentHash: "sha256:containment",
	id: "ward-to-lad",
	method: "clean-containment",
	quality: "publisher-supplied",
	weighting: { status: "not-applicable" },
	from: { geography: "ward", boundaryRelease: "2024" },
	to: { geography: "localAuthority", boundaryRelease: "2024" },
	provenance: { input: "wards.geojson", inputHash: "sha256:wards" },
	validation: { sourceNameConflicts: [], endpoints },
	records: [
		{
			source: { code: "W1", labels: ["Ward"] },
			targets: [{ code: "L1", labels: ["Authority"] }],
		},
	],
};

const overlap: AreaOverlapCrosswalkArtifact = {
	schemaVersion: 1,
	contentHash: "sha256:overlap",
	id: "constituency-to-lad",
	method: "area-overlap",
	quality: "derived",
	weighting: {
		status: "provided",
		basis: "area",
		normalisation: "per-source",
	},
	from: { geography: "constituency", boundaryRelease: "2024" },
	to: { geography: "localAuthority", boundaryRelease: "2024" },
	provenance: {
		inputs: [
			{
				side: "from",
				input: "constituencies.geojson",
				inputHash: "sha256:c",
				sourceCrs: "EPSG:4326",
			},
			{
				side: "to",
				input: "authorities.geojson",
				inputHash: "sha256:l",
				sourceCrs: "EPSG:4326",
			},
		],
		areaProjection: "EPSG:6933",
		clipping: "polygon-clipping@0.15.7",
	},
	validation: {
		sourceNameConflicts: [],
		endpoints,
		overlap: {
			candidatePairCount: 1,
			intersectingPairCount: 1,
			sliverPairCount: 0,
			sliverWidthM: 100,
			widestSliverWidthM: null,
			narrowestOverlapWidthM: 1000,
			minimumCoverage: 0.99,
			minimumSourceCoverage: 1,
			minimumTargetCoverage: 1,
		},
	},
	records: [
		{
			source: {
				code: "C1",
				labels: ["Constituency"],
				areaM2: 1000,
				coverage: 1,
			},
			targets: [
				{
					code: "L1",
					labels: ["Authority"],
					weight: 1,
					overlapAreaM2: 1000,
					sourceShare: 1,
					targetShare: 0.25,
				},
			],
		},
	],
};

test("relates containment and overlap crosswalks from both ends", () => {
	const index = createAreaRelationshipIndex([containment, overlap]);
	assert.deepEqual(
		index.get("constituency/2024/C1")?.map((relationship) => ({
			relation: relationship.relation,
			counterpart: relationship.counterpart.id,
			overlap: relationship.overlap,
		})),
		[
			{
				relation: "overlaps",
				counterpart: "localAuthority/2024/L1",
				overlap: {
					areaM2: 1000,
					shareOfArea: 1,
					shareOfCounterpart: 0.25,
				},
			},
		],
	);
	// The authority sees each share from its own side, and containment
	// carries no overlap figures at all.
	assert.deepEqual(
		index.get("localAuthority/2024/L1")?.map((relationship) => ({
			relation: relationship.relation,
			counterpart: relationship.counterpart.id,
			overlap: relationship.overlap,
		})),
		[
			{
				relation: "contains",
				counterpart: "ward/2024/W1",
				overlap: undefined,
			},
			{
				relation: "overlaps",
				counterpart: "constituency/2024/C1",
				overlap: {
					areaM2: 1000,
					shareOfArea: 0.25,
					shareOfCounterpart: 1,
				},
			},
		],
	);
	assert.equal(index.get("ward/2024/W1")?.[0].relation, "within");
});

test("relates a membership lookup as belonging, and an identity lookup as succession", () => {
	const lookup = (
		id: string,
		relationshipPurpose: "membership" | "identity",
	): PropertyCrosswalkArtifact => ({
		...containment,
		id,
		method: "official-lookup",
		relationshipPurpose,
		weighting: { status: "not-provided" },
	});
	const index = createAreaRelationshipIndex([
		lookup("lad-to-region", "membership"),
		lookup("lad-changes", "identity"),
	]);
	assert.deepEqual(
		index
			.get("ward/2024/W1")
			?.map(({ relation, crosswalk }) => [relation, crosswalk.id]),
		[
			["successor", "lad-changes"],
			["within", "lad-to-region"],
		],
	);
	assert.deepEqual(
		index.get("localAuthority/2024/L1")?.map(({ relation }) => relation),
		["contains", "predecessor"],
	);
});

// A second ward source for the same authority, listed after the first, so an
// authority's relationships come from two crosswalks in a fixed order. A third
// crosswalk names neither release.
const secondContainment: PropertyCrosswalkArtifact = {
	...containment,
	id: "ward-b-to-lad",
	records: [
		{
			source: { code: "W2", labels: ["Ward"] },
			targets: [{ code: "L1", labels: ["Authority"] }],
		},
		{
			source: { code: "W1", labels: ["Ward"] },
			targets: [{ code: "L1", labels: ["Authority"] }],
		},
	],
};
const unrelated: PropertyCrosswalkArtifact = {
	...containment,
	id: "parish-to-district",
	from: { geography: "parish", boundaryRelease: "2019" },
	to: { geography: "district", boundaryRelease: "2019" },
};
const graph = [containment, overlap, secondContainment, unrelated];

/** A lookup that keeps count of the artifacts it hands out. */
const countingLookup = (artifacts: typeof graph) => {
	const handed = new Set<string>();
	const lookup: CrosswalkLookup = {
		get: (id) => artifacts.find((artifact) => artifact.id === id),
		values: () => artifacts,
		where: (predicate) => {
			const chosen = artifacts.filter(predicate);
			for (const artifact of chosen) handed.add(artifact.id);
			return chosen;
		},
	};
	return { lookup, handed };
};

test("a lazily built index answers as the eager one does, in any order", () => {
	const eager = createAreaRelationshipIndex(graph);
	for (const asked of [[...eager.keys()], [...eager.keys()].reverse()]) {
		const lazy = new LazyAreaRelationshipIndex(
			countingLookup(graph).lookup,
		);
		for (const area of asked)
			assert.deepEqual(lazy.get(area), eager.get(area), area);
	}
	const lazy = new LazyAreaRelationshipIndex(
		new Map(graph.map((c) => [c.id, c])),
	);
	assert.deepEqual(
		lazy.get("localAuthority/2024/L1"),
		eager.get("localAuthority/2024/L1"),
	);
	assert.equal(lazy.get("localAuthority/2024/L9"), undefined);
	assert.equal(lazy.get("nowhere/2000/X"), undefined);
});

test("a lazily built index reads only the crosswalks naming the area's release", () => {
	const { lookup, handed } = countingLookup(graph);
	const lazy = new LazyAreaRelationshipIndex(lookup);

	assert.equal(lazy.get("ward/2024/W1")?.length, 2);
	assert.deepEqual([...handed].sort(), ["ward-b-to-lad", "ward-to-lad"]);
	lazy.get("constituency/2024/C1");
	assert.ok(handed.has("constituency-to-lad"));
	assert.ok(!handed.has("parish-to-district"));
});

test("selects artifacts by header from a plain map or a lookup that can", () => {
	const map = new Map(graph.map((crosswalk) => [crosswalk.id, crosswalk]));
	const wards = ({ from }: { from: { geography: string } }) =>
		from.geography === "ward";

	assert.deepEqual(
		selectCrosswalks(map, wards).map((crosswalk) => crosswalk.id),
		["ward-to-lad", "ward-b-to-lad"],
	);
	assert.deepEqual(
		selectCrosswalks(countingLookup(graph).lookup, wards).map(
			(crosswalk) => crosswalk.id,
		),
		["ward-to-lad", "ward-b-to-lad"],
	);
	assert.deepEqual(selectCrosswalks(undefined, wards), []);
});

test("names the codes of a release that have a relationship without building any", () => {
	// A record with no targets relates its source to nothing, so the source is
	// not a related area, though the crosswalk lists it.
	const withUnmatched: PropertyCrosswalkArtifact = {
		...containment,
		id: "ward-c-to-lad",
		records: [
			...containment.records,
			{ source: { code: "W3", labels: ["Ward"] }, targets: [] },
		],
	};
	const crosswalks = [...graph, withUnmatched];
	const eager = createAreaRelationshipIndex(crosswalks);
	const lazy = new LazyAreaRelationshipIndex(
		countingLookup(crosswalks).lookup,
	);

	for (const [geography, release] of [
		["ward", "2024"],
		["localAuthority", "2024"],
		["constituency", "2024"],
		["district", "2019"],
		["nowhere", "2000"],
	] as const) {
		const prefix = `${geography}/${release}/`;
		const expected = [...eager.keys()]
			.filter((area) => area.startsWith(prefix))
			.map((area) => area.slice(prefix.length));
		assert.deepEqual(
			[...lazy.relatedCodes(geography, release)].sort(),
			expected.sort(),
			prefix,
		);
	}
	assert.ok(!lazy.relatedCodes("ward", "2024").has("W3"));
});
