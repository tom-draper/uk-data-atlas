import { atlasCachePath } from "@uk-data-atlas/atlas-runtime/storage";
import { buildAreaSearchIndex } from "../src/cache-build/buildAreaSearchIndex";
import { AreaSearch } from "@uk-data-atlas/atlas-runtime/areas";
import {
	readAreaSearchIndex,
	readAreaLookup,
} from "@uk-data-atlas/atlas-runtime/areas";
import { buildPlaceIndex } from "../src/cache-build/buildPlaceIndex";
import {
	readAreaInventory,
	readPlaceIndex,
} from "@uk-data-atlas/atlas-runtime/areas";
import { readNamedLocationInventory } from "@uk-data-atlas/atlas-runtime/places";
import { resolvePlaces } from "@uk-data-atlas/atlas-runtime/places";
import { buildLocationProjections } from "../../../pipeline/src/buildLocationProjections";
import { createNamedLocationLookup } from "@uk-data-atlas/atlas-runtime/places";
import {
	compileLocationProjections,
	LocationProjectionStore,
} from "@uk-data-atlas/atlas-runtime/places";
import {
	createLocationProjectionStore,
	readLocationProjectionInventory,
} from "@uk-data-atlas/atlas-runtime/places";
import {
	areaLookup,
	containmentCrosswalk,
	crosswalkInventory,
	namedLocationInventory,
} from "./geographyFixtures";
import { createHash } from "node:crypto";
import { readAtlasPayload } from "@uk-data-atlas/atlas-runtime/storage";
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
import { buildAtlasSqlite } from "../../../pipeline/src/buildAtlasSqlite";
import { buildTerrainCatalogue } from "../../../pipeline/src/build-terrain-catalogue";
import { readTerrainCatalogue } from "@uk-data-atlas/atlas-runtime/areas";
import { readPublicManifest } from "@uk-data-atlas/atlas-runtime/storage";
import { route } from "../src/routes";
import type { TerrainCatalogue } from "@uk-data-atlas/terrain";
import { testContext } from "./routeFixtures";
import {
	artifactDirectory,
	artifactRoot,
} from "@uk-data-atlas/atlas-runtime/storage";

const fixture = (context: TestContext) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-sqlite-"));
	context.after(() => rmSync(root, { recursive: true, force: true }));
	const apiRoot = join(root, "services/api");
	mkdirSync(artifactRoot(apiRoot), { recursive: true });
	buildTerrainCatalogue(root);
	writeFileSync(
		join(artifactDirectory(root), "named-locations.json"),
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
		join(artifactDirectory(root), "crosswalk-inventory.json"),
		JSON.stringify({
			schemaVersion: 1,
			contentHash: "crosswalks",
			crosswalks: [],
		}),
	);
	writeFileSync(
		join(artifactRoot(apiRoot), "area-inventory.json"),
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
			["dataset-manifest", "terrain-catalogue"],
		);
		assert.equal(
			database
				.prepare(
					"SELECT payload FROM payloads WHERE id = 'terrain-catalogue'",
				)
				.get()?.payload,
			readFileSync(
				join(artifactRoot(apiRoot), "terrain-catalogue.json"),
				"utf8",
			),
		);
	} finally {
		database.close();
	}
	rmSync(join(artifactRoot(apiRoot), "terrain-catalogue.json"));
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
	rmSync(join(artifactRoot(apiRoot), "terrain-catalogue.json"));
	assert.throws(() => buildAtlasSqlite(root), /ENOENT/);
	assert.deepEqual(readFileSync(path), before);
});

test("dataset metadata references exact payloads and corrupt inputs preserve the published database", (context) => {
	const { root } = fixture(context);
	const content = '{"2024":{"value":42}}\n';
	const entry = {
		type: "nhsWaiting",
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

test("split atlas serves projection routes from the local cache without projection JSON", (context) => {
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
	const obsolete = join(artifactRoot(apiRoot), "location-projections.sqlite");
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
	const publicDirectory = artifactRoot(apiRoot);
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

test("place-index stage preserves atlas data, replaces its tables and removes old outputs", (context) => {
	const { root, apiRoot } = fixture(context);
	const path = buildAtlasSqlite(root);
	const database = new DatabaseSync(path);
	try {
		database.prepare("INSERT INTO payloads VALUES (?, ?)").run(
			"boundary-releases",
			JSON.stringify({
				schemaVersion: 1,
				contentHash: "registry",
				releases: [],
			}),
		);
		database.exec(`
   INSERT INTO area_releases (geography, id, position, status, recordCount, artifact, contentHash, codeProperty, nameProperty)
   VALUES ('localAuthority', '2023-05-uk-bgc', 0, 'available', 1, 'areas/test.json', 'test-area', 'CODE', 'NAME');
   INSERT OR IGNORE INTO geography (slug) VALUES ('localAuthority');
   INSERT INTO area (geography_id, code) SELECT id, 'E08000003' FROM geography WHERE slug = 'localAuthority';
   INSERT INTO area_version VALUES (NULL, (SELECT id FROM area WHERE code = 'E08000003'), 0, 'Manchester', NULL, NULL, NULL, 1);
  `);
	} finally {
		database.close();
	}
	const terrain = readAtlasPayload(root, "terrain-catalogue");
	const manifest = readAtlasPayload(root, "dataset-manifest");
	for (const filename of [
		"place-index.sqlite",
		"place-index.json",
		"place-index.json.gz",
	])
		writeFileSync(join(artifactRoot(apiRoot), filename), "obsolete");
	buildPlaceIndex(root);
	buildPlaceIndex(root);
	assert.equal(readAtlasPayload(root, "terrain-catalogue"), terrain);
	assert.equal(readAtlasPayload(root, "dataset-manifest"), manifest);
	for (const filename of [
		"place-index.sqlite",
		"place-index.json",
		"place-index.json.gz",
	])
		assert.equal(existsSync(join(artifactRoot(apiRoot), filename)), false);
	const search = () =>
		readPlaceIndex(
			apiRoot,
			readAreaInventory(apiRoot),
			readNamedLocationInventory(apiRoot),
		);
	assert.deepEqual(
		resolvePlaces(search(), "manc").map((place) => [
			place.place,
			place.name,
		]),
		[["localAuthority/E08000003", "Manchester"]],
	);
	const changed = new DatabaseSync(path);
	try {
		changed.exec("UPDATE area_version SET name = 'Renamed city'");
	} finally {
		changed.close();
	}
	buildPlaceIndex(root);
	assert.deepEqual(resolvePlaces(search(), "Manchester"), []);
	assert.deepEqual(
		resolvePlaces(search(), "renamed").map((place) => place.name),
		["Renamed city"],
	);
	assert.equal(existsSync(`${path}.place-index.tmp`), false);
});

test("failed place table replacement preserves the database and legacy files", (context) => {
	const { root, apiRoot } = fixture(context);
	const path = buildAtlasSqlite(root);
	const database = new DatabaseSync(path);
	try {
		database.prepare("INSERT INTO payloads VALUES (?, ?)").run(
			"boundary-releases",
			JSON.stringify({
				schemaVersion: 1,
				contentHash: "registry",
				releases: [],
			}),
		);
	} finally {
		database.close();
	}
	const cache = new DatabaseSync(atlasCachePath(root));
	cache.exec("CREATE VIEW place_index_names AS SELECT 1 AS position");
	cache.close();
	const before = readFileSync(path);
	const legacy = join(artifactRoot(apiRoot), "place-index.sqlite");
	writeFileSync(legacy, "retained on failure");
	assert.throws(() => buildPlaceIndex(root), /view/);
	assert.deepEqual(readFileSync(path), before);
	assert.equal(readFileSync(legacy, "utf8"), "retained on failure");
	assert.equal(existsSync(`${path}.place-index.tmp`), false);
});

test("area-search stage replaces its index while retaining place search and other atlas data", (context) => {
	const { root, apiRoot } = fixture(context);
	const path = buildAtlasSqlite(root);
	const database = new DatabaseSync(path);
	try {
		database.prepare("INSERT INTO payloads VALUES (?, ?)").run(
			"boundary-releases",
			JSON.stringify({
				schemaVersion: 1,
				contentHash: "registry",
				releases: [],
			}),
		);
		database.exec(`
   INSERT INTO area_releases (geography, id, position, status, recordCount, artifact, contentHash, codeProperty, nameProperty)
   VALUES ('localAuthority', '2023-05-uk-bgc', 0, 'available', 1, 'areas/test.json', 'test-area', 'CODE', 'NAME');
   INSERT OR IGNORE INTO geography (slug) VALUES ('localAuthority');
   INSERT INTO area (geography_id, code) SELECT id, 'E08000003' FROM geography WHERE slug = 'localAuthority';
   INSERT INTO area_version VALUES (NULL, (SELECT id FROM area WHERE code = 'E08000003'), 0, 'Manchester', NULL, NULL, NULL, 1);
  `);
	} finally {
		database.close();
	}
	buildPlaceIndex(root);
	const terrain = readAtlasPayload(root, "terrain-catalogue");
	for (const filename of [
		"area-search-index.sqlite",
		"area-search-index.json",
		"area-search-index.json.gz",
	])
		writeFileSync(join(artifactRoot(apiRoot), filename), "obsolete");
	buildAreaSearchIndex(root);
	buildAreaSearchIndex(root);
	assert.equal(readAtlasPayload(root, "terrain-catalogue"), terrain);
	for (const filename of [
		"area-search-index.sqlite",
		"area-search-index.json",
		"area-search-index.json.gz",
	])
		assert.equal(existsSync(join(artifactRoot(apiRoot), filename)), false);
	assert.deepEqual(
		resolvePlaces(
			readPlaceIndex(
				apiRoot,
				readAreaInventory(apiRoot),
				readNamedLocationInventory(apiRoot),
			),
			"Manchester",
		).map((place) => place.place),
		["localAuthority/E08000003"],
	);
	const search = (query: string) => {
		const inventory = readAreaInventory(apiRoot);
		return new AreaSearch(
			readAreaSearchIndex(apiRoot, inventory),
			readAreaLookup(apiRoot, inventory),
		)
			.search({ query })
			.slice(0, 10);
	};
	assert.deepEqual(
		search("manc").map((area) => [area.id, area.name]),
		[["localAuthority/2023-05-uk-bgc/E08000003", "Manchester"]],
	);
	const changed = new DatabaseSync(path);
	try {
		changed.exec("UPDATE area_version SET name = 'Renamed city'");
	} finally {
		changed.close();
	}
	buildAreaSearchIndex(root);
	assert.deepEqual(search("Manchester"), []);
	assert.deepEqual(
		search("renamed").map((area) => area.name),
		["Renamed city"],
	);
	assert.equal(existsSync(`${path}.area-search.tmp`), false);
});

test("failed area-search replacement preserves the database and legacy files", (context) => {
	const { root, apiRoot } = fixture(context);
	const path = buildAtlasSqlite(root);
	const database = new DatabaseSync(atlasCachePath(root));
	try {
		database.exec("CREATE VIEW area_search_terms AS SELECT 1 AS position");
	} finally {
		database.close();
	}
	const before = readFileSync(path);
	const legacy = join(artifactRoot(apiRoot), "area-search-index.sqlite");
	writeFileSync(legacy, "retained on failure");
	assert.throws(() => buildAreaSearchIndex(root), /view/);
	assert.deepEqual(readFileSync(path), before);
	assert.equal(readFileSync(legacy, "utf8"), "retained on failure");
	assert.equal(existsSync(`${path}.area-search.tmp`), false);
});
