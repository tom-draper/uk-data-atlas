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
import { test } from "vitest";
import { buildMapResources } from "../../src/maps/buildMapResource";

test("map builds retain tiles, remove obsolete variants and reuse completed releases", async (t) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-map-build-"));
	t.onTestFinished(() => rmSync(root, { recursive: true, force: true }));
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
	// Three identical polygons share every edge, so this release cannot tile.
	const badGeometry = JSON.parse(
		readFileSync(join(root, "data/source/areas.geojson"), "utf8"),
	);
	badGeometry.features = ["A", "B", "C"].map((code) => ({
		...badGeometry.features[0],
		properties: { CODE: code },
	}));
	json("data/source/bad.geojson", badGeometry);
	const registryPath = "data/build/geography/boundary-releases.json";
	const registry = JSON.parse(readFileSync(join(root, registryPath), "utf8"));
	registry.releases.push({ ...registry.releases[0], id: "bad" });
	json(registryPath, registry);
	const inventoryPath = "data/build/artifacts/area-inventory.json";
	const inventory = JSON.parse(
		readFileSync(join(root, inventoryPath), "utf8"),
	);
	inventory.releases.push({
		...inventory.releases[0],
		id: "bad",
		artifact: "areas/ward/bad.json",
	});
	json(inventoryPath, inventory);
	json("data/build/artifacts/areas/ward/bad.json", {
		areas: ["A", "B", "C"].map((code) => ({ code, name: code })),
	});
	const sourcesPath = "data/build/artifacts/geometry-sources.json";
	const sources = JSON.parse(readFileSync(join(root, sourcesPath), "utf8"));
	sources.releases.push({
		...sources.releases[0],
		id: "ward/bad",
		input: "bad.geojson",
	});
	json(sourcesPath, sources);
	const previousJobs = process.env.ATLAS_MAP_RESOURCE_JOBS;
	t.onTestFinished(() => {
		if (previousJobs === undefined)
			delete process.env.ATLAS_MAP_RESOURCE_JOBS;
		else process.env.ATLAS_MAP_RESOURCE_JOBS = previousJobs;
	});
	process.env.ATLAS_MAP_RESOURCE_JOBS = "1";
	for (const name of [
		"ward-test-low.geojson.gz",
		"ward-test-high.parquet",
		"retired.pmtiles",
	])
		writeFileSync(join(root, "data/build/map-resources", name), "obsolete");
	const first = await buildMapResources(root);
	assert.equal(first.resources.length, 1);
	assert.equal(first.unavailable.length, 1);
	assert.match(first.unavailable[0]!.reason, /not a coverage/);
	assert.equal(first.unavailable[0]!.features?.length, 1);
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
	const second = await buildMapResources(root, (line) => logs.push(line));
	assert.deepEqual(second.resources, first.resources);
	assert.deepEqual(logs, []);
	assert.deepEqual(
		readFileSync(join(root, "data/build/map-resources/ward-test.pmtiles")),
		archive,
	);
	const manifest = readFileSync(
		join(root, "data/build/artifacts/map-resources.json"),
	);
	const state = readFileSync(
		join(root, "data/build/map-resources/build-state.json"),
	);
	rmSync(join(root, "data/build/map-resources"), { recursive: true });
	process.env.ATLAS_MAP_RESOURCE_JOBS = "2";
	const parallel = await buildMapResources(root);
	assert.deepEqual(parallel.resources, first.resources);
	assert.deepEqual(parallel.unavailable, first.unavailable);
	assert.deepEqual(
		readFileSync(join(root, "data/build/map-resources/ward-test.pmtiles")),
		archive,
	);
	assert.deepEqual(
		readFileSync(join(root, "data/build/map-resources/build-state.json")),
		state,
	);
	assert.deepEqual(
		readFileSync(join(root, "data/build/artifacts/map-resources.json")),
		manifest,
	);
	// Force the first job to publish, then fail the next worker. The parent
	// must roll the first publication back to the previously saved bytes.
	json("data/build/artifacts/areas/ward/test.json", {
		areas: [{ code: "A", name: "changed" }],
	});
	registry.releases.push({ ...registry.releases[0], id: "missing" });
	json(registryPath, registry);
	inventory.releases.push({
		...inventory.releases[0],
		id: "missing",
		artifact: "areas/ward/missing.json",
	});
	json(inventoryPath, inventory);
	json("data/build/artifacts/areas/ward/missing.json", {
		areas: [{ code: "A", name: "A" }],
	});
	sources.releases.push({
		...sources.releases[0],
		id: "ward/missing",
		input: "missing.geojson",
	});
	json(sourcesPath, sources);
	process.env.ATLAS_MAP_RESOURCE_JOBS = "1";
	await assert.rejects(
		buildMapResources(root),
		/ward\/missing worker failed/,
	);
	assert.deepEqual(
		readFileSync(join(root, "data/build/map-resources/ward-test.pmtiles")),
		archive,
	);
	assert.deepEqual(
		readFileSync(join(root, "data/build/map-resources/build-state.json")),
		state,
	);
	assert.deepEqual(
		readFileSync(join(root, "data/build/artifacts/map-resources.json")),
		manifest,
	);
	assert.deepEqual(
		readdirSync(join(root, "data/build/map-resources")).sort(),
		["build-state.json", "ward-test.pmtiles"],
	);
	const crashLogs: string[] = [];
	await assert.rejects(
		buildMapResources(
			root,
			(line) => crashLogs.push(line),
			new URL("./fixtures/crashResourceWorker.mjs", import.meta.url),
		),
		/ward\/missing worker failed.*stopped early \(17\)/,
	);
	assert.ok(
		crashLogs.some((line) => line.startsWith("ward/test:")),
		"the first release was published before the crash",
	);
	assert.deepEqual(
		readFileSync(join(root, "data/build/map-resources/ward-test.pmtiles")),
		archive,
	);
	assert.deepEqual(
		readFileSync(join(root, "data/build/map-resources/build-state.json")),
		state,
	);
	assert.deepEqual(
		readFileSync(join(root, "data/build/artifacts/map-resources.json")),
		manifest,
	);
	assert.deepEqual(
		readdirSync(join(root, "data/build/map-resources")).sort(),
		["build-state.json", "ward-test.pmtiles"],
	);
});
