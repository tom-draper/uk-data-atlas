import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { onTestFinished, test } from "vitest";
import {
	CACHE_STAGES,
	hashSqliteContent,
	publishCacheTables,
	removeStageStamps,
	stageStampPath,
	stampCacheStage,
} from "../src/storage";
import { checkStagedComponents } from "../src/stamp-atlas-cache";

function memory(...statements: string[]) {
	const database = new DatabaseSync(":memory:");
	onTestFinished(() => database.close());
	for (const statement of statements) database.exec(statement);
	return database;
}

test("a stage's content hash changes with its tables and nothing else", () => {
	const hash = (...extra: string[]) =>
		hashSqliteContent(
			memory(
				"CREATE TABLE mine (code TEXT, n INTEGER, x REAL, b BLOB)",
				"INSERT INTO mine VALUES ('A', 1, 1.5, x'00ff')",
				"CREATE TABLE other (v TEXT)",
				"CREATE TABLE payloads (id TEXT PRIMARY KEY, payload TEXT)",
				"INSERT INTO payloads VALUES ('mine', 'p'), ('theirs', 'q')",
				...extra,
			),
			["mine"],
			["mine"],
		);
	const base = hash();
	assert.equal(base, hash());
	// Other tables and other stages' payloads are not this stage's.
	assert.equal(base, hash("INSERT INTO other VALUES ('x')"));
	assert.equal(
		base,
		hash("UPDATE payloads SET payload = 'changed' WHERE id = 'theirs'"),
	);
	// Its own rows, schema and payload are.
	assert.notEqual(base, hash("INSERT INTO mine VALUES ('B', 2, 2.5, x'00')"));
	assert.notEqual(base, hash("UPDATE mine SET code = 'Z'"));
	assert.notEqual(base, hash("UPDATE mine SET b = x'00fe'"));
	assert.notEqual(base, hash("UPDATE mine SET n = 2"));
	assert.notEqual(base, hash("UPDATE mine SET x = 1.25"));
	assert.notEqual(base, hash("UPDATE mine SET code = NULL"));
	assert.notEqual(
		base,
		hash("UPDATE payloads SET payload = 'p2' WHERE id = 'mine'"),
	);
	assert.notEqual(base, hash("ALTER TABLE mine ADD COLUMN extra TEXT"));
});

test("values of different types do not hash alike", () => {
	const hash = (value: string) =>
		hashSqliteContent(
			memory("CREATE TABLE t (v)", `INSERT INTO t VALUES (${value})`),
			["t"],
		);
	const hashes = new Set([
		hash("1"),
		hash("'1'"),
		hash("1.0"),
		hash("x'31'"),
		hash("NULL"),
	]);
	assert.equal(hashes.size, 5);
});

function cacheFixture() {
	const root = mkdtempSync(join(tmpdir(), "atlas-stamp-stage-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, "data/build"), { recursive: true });
	const canonical = new DatabaseSync(join(root, "data/build/atlas.sqlite"));
	canonical.exec(
		[
			"CREATE TABLE area_inventory_metadata (content_hash TEXT)",
			"INSERT INTO area_inventory_metadata VALUES ('areas-1')",
			"CREATE TABLE named_location_inventory_metadata (content_hash TEXT)",
			"INSERT INTO named_location_inventory_metadata VALUES ('locations-1')",
			"CREATE TABLE payloads (id TEXT PRIMARY KEY, payload TEXT)",
			"INSERT INTO payloads VALUES ('boundary-releases', 'releases-1')",
			"INSERT INTO payloads VALUES ('postcode-index', 'index-1')",
			"INSERT INTO payloads VALUES ('postcode-areas', 'areas-1')",
		].join(";"),
	);
	canonical.close();
	const stamp = (stage: string) =>
		JSON.parse(readFileSync(stageStampPath(root, stage), "utf8")) as Record<
			string,
			string
		>;
	const place = (rows: string[][]) => {
		publishCacheTables(root, "place-index", {
			place_names: { columns: ["name TEXT"], rows },
		});
		stampCacheStage(root, {
			stage: "place-index",
			component: "place-index",
			tables: ["place_names"],
		});
		return stamp("place-index");
	};
	const search = (rows: string[][]) => {
		publishCacheTables(root, "area-search", {
			area_search_codes: { columns: ["code TEXT"], rows },
		});
		stampCacheStage(root, {
			stage: "area-search-index",
			component: "area-search",
			tables: ["area_search_codes"],
		});
		return stamp("area-search-index");
	};
	return { root, place, search, stamp };
}

test("a stamp records the component's generation and a hash of its tables", () => {
	const { root, place } = cacheFixture();
	const first = place([["Leeds"]]);
	assert.deepEqual(Object.keys(first).sort(), [
		"component",
		"content",
		"generation",
	]);
	assert.equal(first.component, "place-index");
	assert.equal(existsSync(stageStampPath(root, "place-index")), true);
	// The same tables stamp the same, so what reads them stays cached.
	assert.deepEqual(place([["Leeds"]]), first);
	// Different tables stamp differently.
	assert.notEqual(place([["Leeds"], ["York"]]).content, first.content);
});

test("a stage's stamp ignores tables other stages add to the same cache", () => {
	const { place, search } = cacheFixture();
	const before = place([["Leeds"]]);
	search([["E1"]]);
	search([["E1"], ["E2"]]);
	// Stamping the unchanged place index again gives the same stamp.
	assert.deepEqual(place([["Leeds"]]), before);
});

test("a stamp's generation changes when the canonical inputs do", () => {
	const { root, place } = cacheFixture();
	const first = place([["Leeds"]]);
	const canonical = new DatabaseSync(join(root, "data/build/atlas.sqlite"));
	canonical.exec(
		"UPDATE area_inventory_metadata SET content_hash = 'areas-2'",
	);
	canonical.close();
	const second = place([["Leeds"]]);
	assert.equal(second.content, first.content);
	assert.notEqual(second.generation, first.generation);
});

test("stamping fails when the cache has no generation for the component", () => {
	const { root } = cacheFixture();
	publishCacheTables(root, "place-index", {
		place_names: { columns: ["name TEXT"], rows: [["Leeds"]] },
	});
	assert.throws(
		() =>
			stampCacheStage(root, {
				stage: "area-search-index",
				component: "area-search",
				tables: ["area_search_codes"],
			}),
		/no area-search generation/,
	);
});

test("removing stamps leaves other files alone", () => {
	const { root, place, search } = cacheFixture();
	place([["Leeds"]]);
	search([["E1"]]);
	removeStageStamps(root, ["place-index", "postcode-counts"]);
	assert.equal(existsSync(stageStampPath(root, "place-index")), false);
	assert.equal(existsSync(stageStampPath(root, "area-search-index")), true);
	assert.deepEqual(CACHE_STAGES, [
		"place-index",
		"area-search-index",
		"postcode-counts",
		"atlas-cache-stamp",
	]);
});

test("the final stamp stage accepts a current cache and drops the stamp of a stale component", () => {
	const { root, place, search } = cacheFixture();
	place([["Leeds"]]);
	search([["E1"]]);
	publishCacheTables(root, "postcode-counts", {
		postcode_counts: { columns: ["code TEXT"], rows: [["A"]] },
	});
	checkStagedComponents(root);
	const canonical = new DatabaseSync(join(root, "data/build/atlas.sqlite"));
	canonical.exec(
		"UPDATE payloads SET payload = 'releases-2' WHERE id = 'boundary-releases'",
	);
	canonical.close();
	assert.throws(() => checkStagedComponents(root), /no current place-index/);
	assert.equal(existsSync(stageStampPath(root, "place-index")), false);
	assert.equal(existsSync(stageStampPath(root, "area-search-index")), true);
});

test("rebuilding a renamed cache table replaces its old table with a view", () => {
	const { root } = cacheFixture();
	const path = join(root, "data/build/atlas-cache.sqlite");
	const old = new DatabaseSync(path);
	old.exec(
		"CREATE TABLE place_index_places (position INTEGER PRIMARY KEY, name TEXT); INSERT INTO place_index_places VALUES (0, 'old')",
	);
	old.close();
	const tables = {
		place_index_place: {
			columns: ["name TEXT"],
			rows: [["new"]],
			views: { place_index_places: "SELECT * FROM place_index_place" },
		},
	};
	publishCacheTables(root, "place-index", tables);
	publishCacheTables(root, "place-index", tables);
	const cache = new DatabaseSync(path, { readOnly: true });
	try {
		assert.equal(
			cache
				.prepare(
					"SELECT type FROM sqlite_schema WHERE name = 'place_index_places'",
				)
				.get()?.type,
			"view",
		);
		assert.equal(
			cache.prepare("SELECT name FROM place_index_places").get()?.name,
			"new",
		);
	} finally {
		cache.close();
	}
});

test("preserves cache generations when migrating the legacy table", () => {
	const { root, place } = cacheFixture();
	const path = join(root, "data/build/atlas-cache.sqlite");
	const old = new DatabaseSync(path);
	old.exec(
		"CREATE TABLE cache_generations (component TEXT PRIMARY KEY, generation TEXT NOT NULL); INSERT INTO cache_generations VALUES ('other', 'old')",
	);
	old.close();
	place([["Leeds"]]);
	const cache = new DatabaseSync(path, { readOnly: true });
	try {
		assert.equal(
			cache
				.prepare(
					"SELECT generation FROM cache_generations WHERE component = 'other'",
				)
				.get()?.generation,
			"old",
		);
	} finally {
		cache.close();
	}
});
