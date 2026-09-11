import assert from "node:assert/strict";
import test from "node:test";
import { createAreaRelationshipIndex } from "../src/areaRelationships";
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
			},
			{ side: "to", input: "authorities.geojson", inputHash: "sha256:l" },
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
