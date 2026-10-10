import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import {
	createCrosswalkInventory,
	crosswalkInventoryFromEntries,
	type PropertyCrosswalkArtifact,
} from "../src/crosswalkInventory";
import {
	addRelatedCodes,
	releaseCoverageOf,
	relatedCodesOf,
	type RelatedCodesByRelease,
} from "../src/relatedCodes";

const endpoints = {
	from: { status: "verified", availableAreaCount: 1, referencedCodeCount: 1 },
	to: { status: "verified", availableAreaCount: 1, referencedCodeCount: 1 },
} as const;

const crosswalk: PropertyCrosswalkArtifact = {
	schemaVersion: 1,
	contentHash: "sha256:ward-to-lad",
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
			source: { code: "W1", labels: [] },
			targets: [{ code: "L1", labels: [] }],
		},
		{
			source: { code: "W2", labels: [] },
			targets: [
				{ code: "L1", labels: [] },
				{ code: "L2", labels: [] },
			],
		},
		// Listed, but related to nothing.
		{ source: { code: "W3", labels: [] }, targets: [] },
	],
};

const area = (code: string) => ({ code, name: code });
const areaLookup = createAreaLookup([
	{
		schemaVersion: 1,
		contentHash: "sha256:wards",
		geography: "ward",
		boundaryRelease: "2024",
		codeProperty: "code",
		nameProperty: "name",
		areas: ["W1", "W2", "W3", "W4"].map(area),
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:lads",
		geography: "localAuthority",
		boundaryRelease: "2024",
		codeProperty: "code",
		nameProperty: "name",
		// L9 is named by no crosswalk; L2 is, but is not held by the release.
		areas: ["L1", "L9"].map(area),
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:parishes",
		geography: "parish",
		boundaryRelease: "2024",
		codeProperty: "code",
		nameProperty: "name",
		areas: ["P1"].map(area),
	},
]);

test("names the codes a crosswalk relates on each side, leaving out a source with no targets", () => {
	const { source, target } = relatedCodesOf(crosswalk);
	assert.deepEqual([...source].sort(), ["W1", "W2"]);
	assert.deepEqual([...target].sort(), ["L1", "L2"]);
});

test("counts a compiled release's related areas, once each, in release order", () => {
	const related: RelatedCodesByRelease = new Map();
	addRelatedCodes(related, crosswalk);
	// A second crosswalk naming the same areas counts them once.
	addRelatedCodes(related, { ...crosswalk, id: "ward-to-lad-again" });

	assert.deepEqual(releaseCoverageOf(related, areaLookup), [
		{
			geography: "localAuthority",
			boundaryRelease: "2024",
			areaCount: 2,
			relatedAreaCount: 1,
		},
		{
			geography: "parish",
			boundaryRelease: "2024",
			areaCount: 1,
			relatedAreaCount: 0,
		},
		{
			geography: "ward",
			boundaryRelease: "2024",
			areaCount: 4,
			relatedAreaCount: 2,
		},
	]);
});

test("a compiled coverage is not part of the inventory's content hash", () => {
	const entries = createCrosswalkInventory([crosswalk]).crosswalks;
	const without = crosswalkInventoryFromEntries(entries);
	const withCoverage = crosswalkInventoryFromEntries(entries, {
		areaInventoryHash: "sha256:areas",
		releases: [],
	});

	assert.equal(without.releaseCoverage, undefined);
	assert.equal(withCoverage.contentHash, without.contentHash);
	assert.equal(
		withCoverage.releaseCoverage?.areaInventoryHash,
		"sha256:areas",
	);
});
