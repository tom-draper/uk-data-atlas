import { buildLocationProjections } from "../scripts/build-location-projections";
import { createNamedLocationLookup } from "../src/namedLocations";
import {
	compileLocationProjections,
	LocationProjectionStore,
} from "../src/locationProjections";
import {
	createLocationProjectionStore,
	readLocationProjectionInventory,
} from "../src/locationLoader";
import {
	areaLookup,
	containmentCrosswalk,
	crosswalkInventory,
	namedLocationInventory,
} from "./geographyFixtures";
import { createHash } from "node:crypto";
import { readAtlasPayload } from "../../../shared/atlasSqlite";
import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test, { type TestContext } from "node:test";
import { buildAtlasSqlite } from "../scripts/build-atlas-sqlite";
import { buildTerrainCatalogue } from "../scripts/build-terrain-catalogue";
import { readTerrainCatalogue } from "../src/boundaryLoader";
import { readPublicManifest } from "../src/publicManifest";
import { route } from "../src/routes";
import type { TerrainCatalogue } from "../src/terrainCatalogue";
import { testContext } from "./routeFixtures";

const fixture = (context: TestContext) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-sqlite-"));
	context.after(() => rmSync(root, { recursive: true, force: true }));
	const apiRoot = join(root, "services/api");
	mkdirSync(join(apiRoot, "public"), { recursive: true });
	buildTerrainCatalogue(root);
	writeFileSync(
		join(root, "services/api/public/named-locations.json"),
		JSON.stringify({
			schemaVersion: 1,
			contentHash: "locations",
			source: {
				artifact: "data/datasets/gazetteer.core.json",
				gazetteerVersion: 1,
			},
			locations: [],
		}),
	);
	writeFileSync(
		join(root, "services/api/public/crosswalk-inventory.json"),
		JSON.stringify({
			schemaVersion: 1,
			contentHash: "crosswalks",
			crosswalks: [],
		}),
	);
	writeFileSync(
		join(apiRoot, "public/area-inventory.json"),
		JSON.stringify({
			schemaVersion: 1,
			contentHash: "areas",
			boundaryRegistryHash: "registry",
			releases: [],
		}),
	);
	mkdirSync(join(root, "data/build/datasets"), { recursive: true });
	writeFileSync(
		join(root, "data/build/datasets/dataset-manifest.json"),
		JSON.stringify({ version: 1, datasets: [] }),
	);
	mkdirSync(join(root, "data/build/location-projections"), {
		recursive: true,
	});
	writeFileSync(
		join(
			root,
			"data/build/location-projections/location-projection-inventory.json",
		),
		JSON.stringify({
			schemaVersion: 1,
			contentHash: "projections",
			namedLocationInventoryHash: "locations",
			crosswalkInventoryHash: "crosswalks",
			shards: [],
			parentShards: [],
		}),
	);
	return { root, apiRoot };
};

test("SQLite terrain loader and every discovery response match the JSON loader byte for byte", (context) => {
	const { root, apiRoot } = fixture(context);
	const before = readPublicManifest<TerrainCatalogue>(
		apiRoot,
		"terrain-catalogue.json",
		"products",
		"terrain catalogue",
	);
	assert.equal(before.products.length, 6);
	const path = buildAtlasSqlite(root);
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		assert.deepEqual(
			database
				.prepare("SELECT id FROM payloads")
				.all()
				.map((row) => row.id),
			[
				"dataset-manifest",
				"location-projection-inventory",
				"terrain-catalogue",
			],
		);
		assert.equal(
			database
				.prepare(
					"SELECT payload FROM payloads WHERE id = 'terrain-catalogue'",
				)
				.get()?.payload,
			readFileSync(
				join(apiRoot, "public/terrain-catalogue.json"),
				"utf8",
			),
		);
	} finally {
		database.close();
	}
	rmSync(join(apiRoot, "public/terrain-catalogue.json"));
	const after = readTerrainCatalogue(apiRoot);
	assert.equal(JSON.stringify(after), JSON.stringify(before));
	for (const url of [
		"/v1/terrain",
		...before.products.map(({ id }) => `/v1/terrain/${id}`),
		"/v1/terrain/missing",
	]) {
		assert.equal(
			JSON.stringify(
				route("GET", url, testContext({ terrainCatalogue: after })),
			),
			JSON.stringify(
				route("GET", url, testContext({ terrainCatalogue: before })),
			),
			url,
		);
	}
});

test("terrain loader refuses a missing database even when JSON exists", (context) => {
	const { apiRoot } = fixture(context);
	assert.throws(
		() => readTerrainCatalogue(apiRoot),
		/unable to open database file/,
	);
});

test("terrain loader refuses missing and invalid SQLite payloads", (context) => {
	const { root, apiRoot } = fixture(context);
	const path = buildAtlasSqlite(root);
	const database = new DatabaseSync(path);
	try {
		database.prepare("DELETE FROM payloads").run();
		assert.throws(
			() => readTerrainCatalogue(apiRoot),
			/Missing terrain catalogue/,
		);
		for (const payload of [
			'{"schemaVersion":2,"products":[]}',
			'{"schemaVersion":1,"products":{}}',
			"invalid json",
		]) {
			database
				.prepare("INSERT OR REPLACE INTO payloads VALUES (?, ?)")
				.run("terrain-catalogue", payload);
			assert.throws(() => readTerrainCatalogue(apiRoot));
		}
	} finally {
		database.close();
	}
});

test("rebuilding SQLite replaces the payload and a missing input preserves the last build", (context) => {
	const { root, apiRoot } = fixture(context);
	const path = buildAtlasSqlite(root);
	const database = new DatabaseSync(path);
	database.prepare("UPDATE payloads SET payload = '{}'").run();
	database.close();
	buildAtlasSqlite(root);
	assert.equal(readTerrainCatalogue(apiRoot).products.length, 6);
	const before = readFileSync(path);
	rmSync(join(apiRoot, "public/terrain-catalogue.json"));
	assert.throws(() => buildAtlasSqlite(root), /ENOENT/);
	assert.deepEqual(readFileSync(path), before);
});

test("dataset metadata references exact payloads and corrupt inputs preserve the published database", (context) => {
	const { root } = fixture(context);
	const content = '{"2024":{"value":42}}\n';
	const entry = {
		type: "sample",
		output: "sample",
		source: { name: "Sample" },
		contract: { version: 1 },
		summary: { datasetCount: 1 },
		fingerprint: "compiler-v1",
		compiled: {
			bytes: Buffer.byteLength(content),
			sha256: createHash("sha256").update(content).digest("hex"),
		},
	};
	const directory = join(root, "data/build/datasets");
	writeFileSync(join(directory, "sample.json"), content);
	const manifest = JSON.stringify({ version: 1, datasets: [entry] });
	writeFileSync(join(directory, "dataset-manifest.json"), manifest);
	const path = buildAtlasSqlite(root);
	assert.equal(readAtlasPayload(root, "dataset:sample"), content);
	assert.equal(readAtlasPayload(root, "dataset-manifest"), manifest);
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		const row = database.prepare("SELECT * FROM datasets").get()!;
		assert.deepEqual(
			{ ...row },
			{
				type: entry.type,
				output: entry.output,
				source: JSON.stringify(entry.source),
				contract: JSON.stringify(entry.contract),
				summary: JSON.stringify(entry.summary),
				fingerprint: entry.fingerprint,
				sha256: entry.compiled.sha256,
				bytes: entry.compiled.bytes,
				payloadId: "dataset:sample",
			},
		);
		assert.deepEqual(
			database.prepare("PRAGMA foreign_key_check").all(),
			[],
		);
	} finally {
		database.close();
	}
	const before = readFileSync(path);
	writeFileSync(join(directory, "sample.json"), "{}");
	assert.throws(() => buildAtlasSqlite(root), /does not match its manifest/);
	assert.deepEqual(readFileSync(path), before);
	assert.equal(readAtlasPayload(root, "dataset:sample"), content);
});

test("shared atlas serves projection routes without projection JSON or a second database", (context) => {
	const { root, apiRoot } = fixture(context);
	const compiled = compileLocationProjections(
		namedLocationInventory,
		crosswalkInventory,
		[containmentCrosswalk],
		areaLookup,
	);
	const directory = join(root, "data/build/location-projections");
	writeFileSync(
		join(directory, "location-projection-inventory.json"),
		JSON.stringify(compiled.inventory),
	);
	for (const shard of [
		...compiled.inventory.shards,
		...compiled.inventory.parentShards,
	]) {
		const artifact = [
			...compiled.artifacts,
			...compiled.parentArtifacts,
		].find(
			(artifact) =>
				artifact.crosswalkId === shard.crosswalkId &&
				(shard.artifact.startsWith("location-parent-projections/")
					? "parentProjections" in artifact
					: "projections" in artifact),
		);
		assert.ok(artifact);
		mkdirSync(join(directory, shard.artifact, ".."), { recursive: true });
		writeFileSync(
			join(directory, shard.artifact),
			JSON.stringify(artifact),
		);
	}
	const obsolete = join(apiRoot, "public/location-projections.sqlite");
	writeFileSync(obsolete, "obsolete database");
	buildAtlasSqlite(root);
	assert.equal(existsSync(obsolete), false);
	const published = readFileSync(join(root, "data/build/atlas.sqlite"));
	writeFileSync(
		join(directory, "location-projection-inventory.json"),
		JSON.stringify({
			...compiled.inventory,
			shards: compiled.inventory.shards.map((shard) => ({
				...shard,
				contentHash: "stale",
			})),
		}),
	);
	assert.throws(() => buildAtlasSqlite(root), /does not match its inventory/);
	assert.deepEqual(
		readFileSync(join(root, "data/build/atlas.sqlite")),
		published,
	);
	// Runtime must use only the shared database, including its inventory.
	rmSync(directory, { recursive: true });
	const inventory = readLocationProjectionInventory(
		apiRoot,
		namedLocationInventory,
		crosswalkInventory,
	);
	assert.equal(JSON.stringify(inventory), JSON.stringify(compiled.inventory));
	const store = createLocationProjectionStore(apiRoot, inventory);
	const before = new LocationProjectionStore(compiled.inventory, (shard) => {
		const artifact = compiled.artifacts.find(
			(artifact) => artifact.crosswalkId === shard.crosswalkId,
		);
		assert.ok(artifact);
		return artifact;
	});
	const inputs = {
		areaLookup,
		namedLocationInventory,
		crosswalkInventory,
		namedLocationLookup: createNamedLocationLookup(namedLocationInventory),
		crosswalkLookup: new Map([
			[containmentCrosswalk.id, containmentCrosswalk],
		]),
	};
	for (const query of [
		"",
		"geography=ward&release=2025-01-en-ward",
		"geography=ward&release=2025-01-en-ward&via=ward-to-local-authority-2025",
	]) {
		const url = `/v1/locations/greater-manchester/members?${query}`;
		const expected = route(
			"GET",
			url,
			testContext({ ...inputs, locationProjectionStore: before }),
		);
		const actual = route(
			"GET",
			url,
			testContext({ ...inputs, locationProjectionStore: store }),
		);
		assert.equal(JSON.stringify(actual), JSON.stringify(expected), url);
		if (query.includes("via=")) assert.equal(actual.status, 200);
	}
	assert.throws(
		() =>
			readLocationProjectionInventory(
				apiRoot,
				{ ...namedLocationInventory, contentHash: "stale" },
				crosswalkInventory,
			),
		/Invalid location projection inventory/,
	);
});

test("projection compilation writes build intermediates and removes old public copies", (context) => {
	const { root, apiRoot } = fixture(context);
	const publicDirectory = join(apiRoot, "public");
	for (const name of [
		"location-projections",
		"location-parent-projections",
	]) {
		mkdirSync(join(publicDirectory, name));
		writeFileSync(join(publicDirectory, name, "obsolete.json"), "obsolete");
	}
	writeFileSync(
		join(publicDirectory, "location-projection-inventory.json"),
		"obsolete",
	);
	const result = buildLocationProjections(root);
	assert.equal(
		result.inventoryPath,
		join(
			root,
			"data/build/location-projections/location-projection-inventory.json",
		),
	);
	assert.deepEqual(
		JSON.parse(readFileSync(result.inventoryPath, "utf8")).shards,
		[],
	);
	for (const name of [
		"location-projections",
		"location-parent-projections",
		"location-projection-inventory.json",
	])
		assert.equal(existsSync(join(publicDirectory, name)), false);
	buildAtlasSqlite(root);
	assert.deepEqual(
		readLocationProjectionInventory(
			apiRoot,
			{ ...namedLocationInventory, contentHash: "locations" },
			{ ...crosswalkInventory, contentHash: "crosswalks" },
		).shards,
		[],
	);
});
