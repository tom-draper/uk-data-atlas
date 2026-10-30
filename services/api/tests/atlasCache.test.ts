import { compareAtlasCache } from "../scripts/compare-atlas-cache";
import assert from "node:assert/strict";
import {
	copyFileSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
	atlasCachePath,
	publishCacheTables,
	requireAtlasCache,
} from "@uk-data-atlas/atlas-runtime/storage";

function fixture(t: { after: (fn: () => void) => void }) {
	const root = mkdtempSync(join(tmpdir(), "atlas-cache-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, "data/build"), { recursive: true });
	const canonical = join(root, "data/build/atlas.sqlite");
	const database = new DatabaseSync(canonical);
	database.exec(
		"CREATE TABLE area_inventory (contentHash TEXT); INSERT INTO area_inventory VALUES ('first'); CREATE TABLE payloads (id TEXT PRIMARY KEY, payload TEXT)",
	);
	database.close();
	return { root, canonical, apiRoot: join(root, "services/api") };
}

const tables = { area_search_codes: { columns: ["code TEXT"], rows: [["A"]] } };

test("cache publication leaves canonical bytes unchanged and detects missing and stale generations", (t) => {
	const { root, canonical, apiRoot } = fixture(t);
	assert.throws(
		() => requireAtlasCache(apiRoot, "area-search"),
		/matching atlas data release/,
	);
	const before = readFileSync(canonical);
	publishCacheTables(root, "area-search", tables);
	assert.equal(
		requireAtlasCache(apiRoot, "area-search"),
		atlasCachePath(root),
	);
	assert.deepEqual(readFileSync(canonical), before);
	const database = new DatabaseSync(canonical);
	database.exec("UPDATE area_inventory SET contentHash = 'second'");
	database.close();
	assert.throws(
		() => requireAtlasCache(apiRoot, "area-search"),
		/stale.*area-search|area-search.*matching atlas data release/,
	);
	publishCacheTables(root, "area-search", tables);
	assert.equal(
		requireAtlasCache(apiRoot, "area-search"),
		atlasCachePath(root),
	);
});

test("a failed cache replacement preserves the published component", (t) => {
	const { root, apiRoot } = fixture(t);
	publishCacheTables(root, "area-search", tables);
	const before = readFileSync(atlasCachePath(root));
	assert.throws(
		() =>
			publishCacheTables(root, "area-search", {
				area_search_codes: {
					columns: ["code TEXT NOT NULL"],
					rows: [[null]],
				},
			}),
		/NOT NULL/,
	);
	assert.deepEqual(readFileSync(atlasCachePath(root)), before);
	assert.equal(
		requireAtlasCache(apiRoot, "area-search"),
		atlasCachePath(root),
	);
});

test("the split comparison checks actual table contents and fails on a changed value", (t) => {
	const { root, canonical, apiRoot } = fixture(t);
	const database = new DatabaseSync(canonical);
	database.exec(
		"CREATE TABLE area_search_codes (position INTEGER PRIMARY KEY, code TEXT); INSERT INTO area_search_codes VALUES (0, 'A')",
	);
	database.close();
	const before = join(root, "before.sqlite");
	copyFileSync(canonical, before);
	const split = new DatabaseSync(canonical);
	split.exec("DROP TABLE area_search_codes");
	split.close();
	publishCacheTables(root, "area-search", tables);
	const report = compareAtlasCache(before, apiRoot);
	assert.equal(report.mismatches, 0);
	assert.equal(
		report.comparisons.find((row) => row.name === "area_search_codes")
			?.rows,
		1,
	);
	const cache = new DatabaseSync(atlasCachePath(root));
	cache.exec("UPDATE area_search_codes SET code = 'B'");
	cache.close();
	assert.throws(
		() => compareAtlasCache(before, apiRoot),
		/area_search_codes/,
	);
});
