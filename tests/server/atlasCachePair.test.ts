import { mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	atlasCachePath,
	cacheGeneration,
	closeAllReadOnlyDatabases,
	configureReadOnlyDatabases,
	readCachePayload,
	requireAtlasCache,
} from "@uk-data-atlas/atlas-runtime/storage";

let root: string;
const atlasPath = () => join(root, "data/build/atlas.sqlite");

/** Replace a database by renaming a new file over it, as the pipeline does. */
const replace = (path: string, build: (database: DatabaseSync) => void) => {
	const temporary = `${path}.tmp`;
	rmSync(temporary, { force: true });
	const database = new DatabaseSync(temporary);
	build(database);
	database.close();
	renameSync(temporary, path);
};

const writeAtlas = (hash: string) =>
	replace(atlasPath(), (database) =>
		database.exec(
			`CREATE TABLE area_inventory_metadata (content_hash TEXT); INSERT INTO area_inventory_metadata VALUES ('${hash}')`,
		),
	);

const writeCache = (payload: string) =>
	replace(atlasCachePath(root), (database) => {
		database.exec(
			"CREATE TABLE cache_generation (component TEXT PRIMARY KEY, generation TEXT NOT NULL); CREATE TABLE payloads (id TEXT PRIMARY KEY, payload TEXT NOT NULL)",
		);
		database
			.prepare("INSERT INTO cache_generation VALUES (?, ?)")
			.run("area-search", cacheGeneration(root, "area-search"));
		database
			.prepare("INSERT INTO payloads VALUES (?, ?)")
			.run("index", payload);
	});

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "atlas-cache-pair-"));
	mkdirSync(join(root, "data/build"), { recursive: true });
	configureReadOnlyDatabases({ recheckMs: 0 });
	writeAtlas("a");
	writeCache("first");
});

afterEach(() => {
	closeAllReadOnlyDatabases();
	configureReadOnlyDatabases({ recheckMs: 1000 });
	rmSync(root, { recursive: true, force: true });
});

describe("atlas.sqlite and atlas-cache.sqlite", () => {
	it("serves a cache stamped for the canonical database", () => {
		expect(readCachePayload(root, "area-search", "index")).toBe("first");
		expect(requireAtlasCache(root, "area-search")).toBe(
			atlasCachePath(root),
		);
	});

	it("refuses the cache once atlas.sqlite is replaced under it", () => {
		expect(readCachePayload(root, "area-search", "index")).toBe("first");
		writeAtlas("b");
		expect(() => readCachePayload(root, "area-search", "index")).toThrow(
			/stale/i,
		);
	});

	it("serves again once the cache matches the new database", () => {
		writeAtlas("b");
		expect(() => requireAtlasCache(root, "area-search")).toThrow();
		writeCache("second");
		expect(readCachePayload(root, "area-search", "index")).toBe("second");
	});

	it("refuses a replacement cache stamped for another database", () => {
		expect(requireAtlasCache(root, "area-search")).toBeTruthy();
		const other = mkdtempSync(join(tmpdir(), "atlas-cache-other-"));
		try {
			mkdirSync(join(other, "data/build"), { recursive: true });
			const stale = new DatabaseSync(
				join(other, "data/build/atlas.sqlite"),
			);
			stale.exec(
				"CREATE TABLE area_inventory_metadata (content_hash TEXT); INSERT INTO area_inventory_metadata VALUES ('z')",
			);
			stale.close();
			const generation = cacheGeneration(other, "area-search");
			closeAllReadOnlyDatabases();
			replace(atlasCachePath(root), (database) => {
				database.exec(
					"CREATE TABLE cache_generation (component TEXT PRIMARY KEY, generation TEXT NOT NULL)",
				);
				database
					.prepare("INSERT INTO cache_generation VALUES (?, ?)")
					.run("area-search", generation);
			});
			expect(() => requireAtlasCache(root, "area-search")).toThrow(
				/stale/i,
			);
		} finally {
			rmSync(other, { recursive: true, force: true });
		}
	});

	it("reports a missing cache", () => {
		rmSync(atlasCachePath(root));
		expect(() => requireAtlasCache(root, "area-search")).toThrow(
			/Missing or stale/,
		);
	});
});
