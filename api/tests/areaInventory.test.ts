import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { compileAreas } from "../src/areaInventory";
import type { BoundaryRegistry } from "../src/boundaryRegistry";

const registry: BoundaryRegistry = {
	schemaVersion: 1,
	contentHash: "sha256:boundaries",
	releases: [
		{
			id: "2025-12-en-bgc",
			geography: "combinedAuthority",
			title: "Combined authorities",
			coverage: { countries: ["GB-ENG"] },
			source: {
				publisher: "ONS",
				url: "https://example.com",
				licence: { name: "Open Government Licence" },
			},
			metadataHash: "sha256:metadata",
		},
	],
};

test("compiles canonical area identities from an unambiguous GeoJSON source", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	const directory = join(
		root,
		"data",
		"boundaries",
		"combined-authority",
		"2025-12-en-bgc",
	);
	mkdirSync(directory, { recursive: true });
	writeFileSync(
		join(directory, "meta.json"),
		JSON.stringify({ files: [{ path: "areas.geojson", role: "source" }] }),
	);
	writeFileSync(
		join(directory, "areas.geojson"),
		JSON.stringify({
			type: "FeatureCollection",
			features: [
				{
					properties: {
						CAUTH25CD: "E47000001",
						CAUTH25NM: "Greater Manchester",
					},
				},
			],
		}),
	);

	try {
		const { artifacts, inventory } = compileAreas(root, registry);
		assert.equal(artifacts.length, 1);
		assert.deepEqual(artifacts[0].areas, [
			{ code: "E47000001", name: "Greater Manchester" },
		]);
		assert.deepEqual(inventory.releases[0], {
			id: "2025-12-en-bgc",
			geography: "combinedAuthority",
			status: "available",
			recordCount: 1,
			artifact: "areas/combinedAuthority/2025-12-en-bgc.json",
			contentHash: artifacts[0].contentHash,
			codeProperty: "CAUTH25CD",
			nameProperty: "CAUTH25NM",
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("uses a release-specific adapter when a source contains parent fields", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	const directory = join(
		root,
		"data",
		"boundaries",
		"combined-authority",
		"2025-12-en-bgc",
	);
	mkdirSync(directory, { recursive: true });
	writeFileSync(
		join(directory, "meta.json"),
		JSON.stringify({ files: [{ path: "areas.geojson", role: "source" }] }),
	);
	writeFileSync(
		join(directory, "areas.geojson"),
		JSON.stringify({
			type: "FeatureCollection",
			features: [
				{
					properties: {
						CAUTH25CD: "E47000001",
						CAUTH25NM: "Greater Manchester",
						LAD25CD: "E08000001",
						LAD25NM: "Bolton",
					},
				},
			],
		}),
	);

	try {
		const { artifacts } = compileAreas(root, registry, {
			"combinedAuthority/2025-12-en-bgc": {
				codeProperty: "CAUTH25CD",
				nameProperty: "CAUTH25NM",
			},
		});
		assert.deepEqual(artifacts[0].areas, [
			{ code: "E47000001", name: "Greater Manchester" },
		]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("coalesces matching feature fragments for one official area code", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	const directory = join(
		root,
		"data",
		"boundaries",
		"combined-authority",
		"2025-12-en-bgc",
	);
	mkdirSync(directory, { recursive: true });
	writeFileSync(
		join(directory, "meta.json"),
		JSON.stringify({ files: [{ path: "areas.geojson", role: "source" }] }),
	);
	writeFileSync(
		join(directory, "areas.geojson"),
		JSON.stringify({
			type: "FeatureCollection",
			features: [
				{
					properties: {
						CAUTH25CD: "E47000001",
						CAUTH25NM: "Greater Manchester",
					},
				},
				{
					properties: {
						CAUTH25CD: "E47000001",
						CAUTH25NM: "Greater Manchester",
					},
				},
			],
		}),
	);

	try {
		const { artifacts } = compileAreas(root, registry);
		assert.equal(artifacts[0].areas.length, 1);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("derives a target release from a filtered raw GeoJSON source", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	const sourceDirectory = join(
		root,
		"data",
		"boundaries",
		"lsoa",
		"2011-12-ew-bgc-v3",
	);
	mkdirSync(sourceDirectory, { recursive: true });
	writeFileSync(
		join(sourceDirectory, "meta.json"),
		JSON.stringify({ files: [{ path: "areas.geojson", role: "source" }] }),
	);
	writeFileSync(
		join(sourceDirectory, "areas.geojson"),
		JSON.stringify({
			type: "FeatureCollection",
			features: [
				{
					properties: {
						LSOA11CD: "E01000001",
						LSOA11NM: "England area",
					},
				},
				{
					properties: {
						LSOA11CD: "W01000001",
						LSOA11NM: "Wales area",
					},
				},
			],
		}),
	);
	const lsoaRegistry: BoundaryRegistry = {
		...registry,
		releases: [
			{
				id: "2011-12-w-bgc",
				geography: "lsoa",
				title: "Lower-layer Super Output Areas",
				coverage: { countries: ["GB-WLS"] },
				source: registry.releases[0].source,
				metadataHash: "sha256:wales",
			},
		],
	};

	try {
		const sourceAdapter = {
			source: { geography: "lsoa", boundaryRelease: "2011-12-ew-bgc-v3" },
			filter: { property: "LSOA11CD", startsWith: "W" },
		};
		const { artifacts, inventory } = compileAreas(
			root,
			lsoaRegistry,
			{},
			{ "lsoa/2011-12-w-bgc": sourceAdapter },
		);
		assert.deepEqual(artifacts[0].areas, [
			{ code: "W01000001", name: "Wales area" },
		]);
		assert.deepEqual(artifacts[0].derivedFrom, sourceAdapter);
		const [release] = inventory.releases;
		assert.equal(release.status, "available");
		if (release.status === "available") {
			assert.deepEqual(release.derivedFrom, sourceAdapter);
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
