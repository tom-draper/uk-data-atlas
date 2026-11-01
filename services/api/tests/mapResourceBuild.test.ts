import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildMapResources } from "../../../pipeline/src/buildMapResource";

test("map builds retain tiles, remove obsolete variants and reuse completed releases", (t) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-map-build-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const repository = resolve(import.meta.dirname, "../../..");
	symlinkSync(join(repository, "packages"), join(root, "packages"));
	symlinkSync(join(repository, "pipeline"), join(root, "pipeline"));
	const json = (path: string, value: unknown) =>
		writeFileSync(join(root, path), JSON.stringify(value));
	for (const path of [
		"services/api",
		"data/source",
		"data/build/geography",
		"data/build/artifacts/areas/ward",
		"data/build/map-resources",
	])
		mkdirSync(join(root, path), { recursive: true });
	json("data/source/areas.geojson", {
		type: "FeatureCollection",
		features: [
			{
				type: "Feature",
				properties: { CODE: "A" },
				geometry: {
					type: "Polygon",
					coordinates: [
						[
							[0, 50],
							[1, 50],
							[1, 51],
							[0, 51],
							[0, 50],
						],
					],
				},
			},
		],
	});
	json("data/build/geography/boundary-releases.json", {
		releases: [
			{
				geography: "ward",
				id: "test",
				title: "Test",
				source: {
					publisher: "ONS",
					url: "https://example.com",
					licence: { name: "OGL" },
				},
			},
		],
	});
	json("data/build/artifacts/area-inventory.json", {
		releases: [
			{
				geography: "ward",
				id: "test",
				status: "available",
				artifact: "areas/ward/test.json",
			},
		],
	});
	json("data/build/artifacts/areas/ward/test.json", {
		areas: [{ code: "A", name: "Ay" }],
	});
	json("data/build/artifacts/geometry-sources.json", {
		schemaVersion: 1,
		releases: [
			{
				id: "ward/test",
				status: "available",
				input: "areas.geojson",
				crs: "EPSG:4326",
				codeProperty: "CODE",
			},
		],
	});
	for (const name of [
		"ward-test-low.geojson.gz",
		"ward-test-high.parquet",
		"retired.pmtiles",
	])
		writeFileSync(join(root, "data/build/map-resources", name), "obsolete");
	const first = buildMapResources(root);
	assert.equal(first.resources.length, 1);
	assert.equal(first.resources[0]!.features.length, 6);
	assert.ok(first.resources[0]!.features.every((entry) => !entry.artifact));
	assert.deepEqual(
		readdirSync(join(root, "data/build/map-resources")).sort(),
		["build-state.json", "ward-test.pmtiles"],
	);
	const archive = readFileSync(
		join(root, "data/build/map-resources/ward-test.pmtiles"),
	);
	const logs: string[] = [];
	const second = buildMapResources(root, (line) => logs.push(line));
	assert.deepEqual(second.resources, first.resources);
	assert.deepEqual(logs, []);
	assert.deepEqual(
		readFileSync(join(root, "data/build/map-resources/ward-test.pmtiles")),
		archive,
	);
});
