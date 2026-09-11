import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createGeometrySourceRegistry } from "../src/geometrySourceRegistry";
import type { AreaReleaseArtifact } from "../src/areaInventory";

const writeBoundarySource = (
	root: string,
	geography: string,
	boundaryRelease: string,
	filename: string,
	geojson: unknown,
) => {
	const directory = join(
		root,
		"data",
		"boundaries",
		geography,
		boundaryRelease,
	);
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, filename), JSON.stringify(geojson));
	writeFileSync(
		join(directory, "meta.json"),
		JSON.stringify({ files: [{ path: filename, role: "source" }] }),
	);
};

const artifact = (
	overrides: Partial<AreaReleaseArtifact>,
): AreaReleaseArtifact => ({
	schemaVersion: 1,
	contentHash: "sha256:areas",
	geography: "ward",
	boundaryRelease: "2025",
	codeProperty: "WD25CD",
	nameProperty: "WD25NM",
	areas: [],
	...overrides,
});

test("marks a release available with its CRS and code property", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeBoundarySource(root, "ward", "2025", "wards.geojson", {
			type: "FeatureCollection",
			crs: { type: "name", properties: { name: "EPSG:4326" } },
			features: [],
		});
		const registry = createGeometrySourceRegistry(root, [artifact({})]);
		assert.deepEqual(registry.releases, [
			{
				id: "ward/2025",
				status: "available",
				input: "boundaries/ward/2025/wards.geojson",
				crs: "EPSG:4326",
				codeProperty: "WD25CD",
			},
		]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("defaults to EPSG:4326 when the source declares no CRS", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeBoundarySource(root, "ward", "2025", "wards.geojson", {
			type: "FeatureCollection",
			features: [],
		});
		const registry = createGeometrySourceRegistry(root, [artifact({})]);
		assert.equal(registry.releases[0].crs, "EPSG:4326");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("marks a release not-available when no raw source exists", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const registry = createGeometrySourceRegistry(root, [artifact({})]);
		assert.deepEqual(registry.releases, [
			{
				id: "ward/2025",
				status: "not-available",
				reason: "No declared raw GeoJSON source is available.",
			},
		]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("uses the original raw source location for a derived boundary release", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeBoundarySource(root, "lsoa", "2011-12-ew-bgc-v3", "lsoa.geojson", {
			type: "FeatureCollection",
			crs: { type: "name", properties: { name: "EPSG:4326" } },
			features: [],
		});
		const registry = createGeometrySourceRegistry(root, [
			artifact({
				geography: "lsoa",
				boundaryRelease: "2011-12-w-bgc",
				codeProperty: "LSOA11CD",
				derivedFrom: {
					source: {
						geography: "lsoa",
						boundaryRelease: "2011-12-ew-bgc-v3",
					},
					filter: { property: "LSOA11CD", startsWith: "W" },
				},
			}),
		]);
		assert.deepEqual(registry.releases, [
			{
				id: "lsoa/2011-12-w-bgc",
				status: "available",
				input: "boundaries/lsoa/2011-12-ew-bgc-v3/lsoa.geojson",
				crs: "EPSG:4326",
				codeProperty: "LSOA11CD",
				selection: { property: "LSOA11CD", startsWith: "W" },
			},
		]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("records the grid corrections a release declares", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeBoundarySource(root, "ward", "2025", "wards.geojson", {
			type: "FeatureCollection",
			crs: { type: "name", properties: { name: "EPSG:27700" } },
			features: [],
		});
		const directory = join(root, "data", "boundaries", "ward", "2025");
		writeFileSync(
			join(directory, "meta.json"),
			JSON.stringify({
				files: [{ path: "wards.geojson", role: "source" }],
				corrections: ["northern-ireland-offset"],
			}),
		);
		const [release] = createGeometrySourceRegistry(root, [
			artifact({}),
		]).releases;
		assert.deepEqual(release.corrections, ["northern-ireland-offset"]);
		assert.equal(release.crs, "EPSG:27700");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
