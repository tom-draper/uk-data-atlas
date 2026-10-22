import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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
			["terrain-catalogue"],
		);
		assert.equal(
			database.prepare("SELECT payload FROM payloads").get()?.payload,
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
