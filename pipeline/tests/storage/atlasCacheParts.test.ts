import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { onTestFinished, test } from "vitest";
import {
	atlasCachePartPath,
	CACHE_VERSION,
	cacheGeneration,
} from "@uk-data-atlas/atlas-db";
import {
	assembleAtlasCache,
	CACHE_COMPONENTS,
	checkCachePart,
	publishCacheTables,
	stageStampPath,
	writeCachePart,
	writeCacheTables,
	writeStageStamp,
} from "../../src/storage";
import {
	payloadTable,
	writeBuildMetadata,
} from "../../src/storage/buildMetadataWriter";

/** The inventory headers the cache components are generated from. */
const inventories = (areas: string, locations: string) => ({
	area_inventory_metadata: {
		columns: ["content_hash TEXT"],
		rows: [[areas]],
	},
	named_location_inventory_metadata: {
		columns: ["content_hash TEXT"],
		rows: [[locations]],
	},
});

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "atlas-cache-work-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, "data/build"), { recursive: true });
	new DatabaseSync(join(root, "data/build/atlas.sqlite")).close();
	writeBuildMetadata(join(root, "data/build/atlas.sqlite"), {
		...inventories("areas-1", "locations-1"),
		payload: payloadTable([
			["boundary-releases", "releases-1"],
			["postcode-index", "index-1"],
			["postcode-areas", "areas-1"],
		]),
	});
	const published = join(root, "data/build/atlas-cache.sqlite");
	const place = (name = "Leeds") =>
		writeCacheTables(root, "place-index", {
			place_names: { columns: ["name TEXT"], rows: [[name]] },
		});
	const search = (code = "E01") =>
		writeCacheTables(root, "area-search", {
			area_search_codes: { columns: ["code TEXT"], rows: [[code]] },
		});
	const counts = () =>
		writeCacheTables(root, "postcode-counts", {
			postcode_count: { columns: ["code TEXT"], rows: [["A"]] },
		});
	const tablesIn = (path: string) => {
		const database = new DatabaseSync(path, { readOnly: true });
		try {
			return database
				.prepare(
					"SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT IN ('meta', 'payloads', 'cache_generation') ORDER BY name",
				)
				.all()
				.map((row) => String(row.name));
		} finally {
			database.close();
		}
	};
	return { root, published, place, search, counts, tablesIn };
}

const temporaryFiles = (directory: string) =>
	readdirSync(directory).filter((name) => name.endsWith(".tmp"));

test("a stage's part holds its component, the shared tables and nothing of any other stage", () => {
	const { root, place, search, tablesIn } = fixture();
	const part = place();
	assert.equal(part, atlasCachePartPath(root, "place-index"));
	search();
	assert.deepEqual(tablesIn(part), ["place_names"]);
	const database = new DatabaseSync(part, { readOnly: true });
	try {
		assert.deepEqual(
			database
				.prepare("SELECT key, value FROM meta")
				.all()
				.map((row) => [row.key, row.value]),
			[["cacheVersion", String(CACHE_VERSION)]],
		);
		assert.deepEqual(
			database
				.prepare("SELECT component FROM cache_generation")
				.all()
				.map((row) => row.component),
			["place-index"],
		);
	} finally {
		database.close();
	}
	// Writing the stage's part again replaces it, and touches no other.
	const other = readFileSync(atlasCachePartPath(root, "area-search"));
	place("York");
	assert.deepEqual(
		readFileSync(atlasCachePartPath(root, "area-search")),
		other,
	);
	const again = new DatabaseSync(part, { readOnly: true });
	try {
		assert.deepEqual(
			again
				.prepare("SELECT name FROM place_names")
				.all()
				.map((row) => row.name),
			["York"],
		);
	} finally {
		again.close();
	}
});

test("a stage that fails leaves its earlier part as it was, and no temporary file", () => {
	const { root, place } = fixture();
	const part = place();
	const before = readFileSync(part);
	assert.throws(
		() =>
			writeCachePart(root, {
				component: "place-index",
				write: (database) => {
					database.exec("CREATE TABLE half (x TEXT)");
					throw new Error("stage failed");
				},
			}),
		/stage failed/,
	);
	assert.deepEqual(readFileSync(part), before);
	assert.deepEqual(
		temporaryFiles(join(root, "data/build/atlas-cache-parts")),
		[],
	);
});

test("a part is refused when the canonical inputs change while it is written", () => {
	const { root } = fixture();
	assert.throws(
		() =>
			writeCachePart(root, {
				component: "place-index",
				write: () => {
					const build = new DatabaseSync(
						join(root, "data/build/atlas-build.sqlite"),
					);
					build.exec(
						"UPDATE area_inventory_metadata SET content_hash = 'areas-2'",
					);
					build.close();
				},
			}),
		/Canonical cache inputs changed/,
	);
	assert.equal(existsSync(atlasCachePartPath(root, "place-index")), false);
});

const COMPONENTS = ["place-index", "area-search", "postcode-counts"] as const;

test("the cache is assembled from every part, with the content hash of the canonical database", () => {
	const { root, published, place, search, counts, tablesIn } = fixture();
	place();
	search();
	counts();
	const hash = assembleAtlasCache(root, COMPONENTS);
	assert.deepEqual(tablesIn(published), [
		"area_search_codes",
		"place_names",
		"postcode_count",
	]);
	const cache = new DatabaseSync(published, { readOnly: true });
	try {
		assert.deepEqual(
			cache
				.prepare("SELECT key, value FROM meta ORDER BY key")
				.all()
				.map((row) => [row.key, row.value]),
			[
				["atlas-sqlite-content-hash", hash],
				["cacheVersion", String(CACHE_VERSION)],
			],
		);
		assert.deepEqual(
			cache
				.prepare(
					"SELECT component FROM cache_generation ORDER BY component",
				)
				.all()
				.map((row) => row.component),
			["area-search", "place-index", "postcode-counts"],
		);
		assert.deepEqual(
			cache
				.prepare("SELECT name FROM sqlite_schema ORDER BY rowid")
				.all()
				.map((row) => row.name),
			[
				"meta",
				"payloads",
				"cache_generation",
				"place_names",
				"area_search_codes",
				"postcode_count",
			],
		);
	} finally {
		cache.close();
	}
	assert.deepEqual(temporaryFiles(join(root, "data/build")), []);
});

test("the parts are assembled in the order of the cache's components", () => {
	assert.deepEqual(CACHE_COMPONENTS, [
		"projections",
		"datasets",
		"place-index",
		"area-search",
		"postcode-counts",
	]);
});

test("assembling copies each table and its rows as the part holds them", () => {
	const { root, published } = fixture();
	writeCacheTables(root, "place-index", {
		place_names: {
			columns: ["name TEXT", "rank INTEGER"],
			rows: [
				["York", 2],
				["Leeds", 1],
				["Bath", 3],
			],
		},
	});
	writeCachePart(root, {
		component: "area-search",
		write: (database) => {
			database.exec(
				"CREATE TABLE area_search_codes (code TEXT PRIMARY KEY, note BLOB) STRICT, WITHOUT ROWID",
			);
			database
				.prepare("INSERT INTO area_search_codes VALUES (?, ?)")
				.run("E01", new Uint8Array([1, 2, 3]));
			database
				.prepare("INSERT OR REPLACE INTO payloads VALUES (?, ?)")
				.run("index", "{}");
		},
	});
	assembleAtlasCache(root, ["place-index", "area-search"]);
	const cache = new DatabaseSync(published, { readOnly: true });
	try {
		assert.deepEqual(
			cache
				.prepare("SELECT name, rank FROM place_names")
				.all()
				.map((row) => [row.name, row.rank]),
			[
				["York", 2],
				["Leeds", 1],
				["Bath", 3],
			],
		);
		assert.match(
			String(
				cache
					.prepare(
						"SELECT sql FROM sqlite_schema WHERE name = 'area_search_codes'",
					)
					.get()?.sql,
			),
			/PRIMARY KEY, note BLOB\) STRICT, WITHOUT ROWID$/,
		);
		assert.deepEqual(
			[
				...(cache.prepare("SELECT note FROM area_search_codes").get()!
					.note as Uint8Array),
			],
			[1, 2, 3],
		);
		assert.equal(
			cache
				.prepare("SELECT payload FROM payloads WHERE id = 'index'")
				.get()?.payload,
			"{}",
		);
	} finally {
		cache.close();
	}
});

test("nothing of an earlier cache is kept, whatever version it was", () => {
	const { root, published, place, tablesIn } = fixture();
	place();
	for (const version of [
		`INSERT INTO meta VALUES ('cacheVersion', '${CACHE_VERSION - 1}')`,
		`INSERT INTO meta VALUES ('cacheVersion', '${CACHE_VERSION}')`,
		"SELECT 1",
	]) {
		rmSync(published, { force: true });
		const old = new DatabaseSync(published);
		old.exec(
			[
				"CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID",
				version,
				// Tables under the retired names, and one a stage no longer builds.
				"CREATE TABLE area_search_codes (code TEXT)",
				"CREATE TABLE place_index_places (name TEXT)",
				"CREATE TABLE cache_generations (component TEXT, generation TEXT)",
			].join(";"),
		);
		old.close();
		assembleAtlasCache(root, ["place-index"]);
		assert.deepEqual(tablesIn(published), ["place_names"]);
		const cache = new DatabaseSync(published, { readOnly: true });
		try {
			assert.deepEqual(
				cache
					.prepare(
						"SELECT count(*) AS n FROM sqlite_schema WHERE type = 'view'",
					)
					.get()?.n,
				0,
			);
		} finally {
			cache.close();
		}
	}
});

test("a cache is refused for a part that is missing or was built for other inputs", () => {
	const { root, published, place, search, counts } = fixture();
	place();
	search();
	assert.throws(
		() => assembleAtlasCache(root, COMPONENTS),
		/no current postcode-counts/,
	);
	counts();
	checkCachePart(root, "postcode-counts");
	rmSync(atlasCachePartPath(root, "area-search"));
	assert.throws(
		() => assembleAtlasCache(root, COMPONENTS),
		/no current area-search/,
	);
	search();
	writeBuildMetadata(join(root, "data/build/atlas.sqlite"), {
		...inventories("areas-1", "locations-1"),
		payload: payloadTable([
			["boundary-releases", "releases-2"],
			["postcode-index", "index-1"],
			["postcode-areas", "areas-1"],
		]),
	});
	assert.throws(
		() => assembleAtlasCache(root, COMPONENTS),
		/no current place-index/,
	);
	// A refused build publishes nothing.
	assert.equal(existsSync(published), false);
	assert.deepEqual(temporaryFiles(join(root, "data/build")), []);
});

test("a published cache is left as it was when the assembly fails", () => {
	const { root, published, place, search, counts } = fixture();
	place();
	search();
	counts();
	assembleAtlasCache(root, COMPONENTS);
	const before = readFileSync(published);
	rmSync(atlasCachePartPath(root, "place-index"));
	assert.throws(() => assembleAtlasCache(root, COMPONENTS));
	assert.deepEqual(readFileSync(published), before);
});

test("one part can be written for a canonical database that is not atlas.sqlite", () => {
	const { root } = fixture();
	const base = join(root, "data/build/atlas-base.sqlite");
	new DatabaseSync(base).close();
	writeBuildMetadata(base, {
		area_inventory_metadata: {
			columns: ["content_hash TEXT"],
			rows: [["base-areas"]],
		},
		named_location_inventory_metadata: {
			columns: ["content_hash TEXT"],
			rows: [["base-locations"]],
		},
		crosswalk_inventory_metadata: {
			columns: ["content_hash TEXT"],
			rows: [["base-crosswalks"]],
		},
		payload: payloadTable([]),
	});
	writeCachePart(
		root,
		{
			component: "area-search",
			write: (database) =>
				database.exec("CREATE TABLE area_search_codes (code TEXT)"),
		},
		{ canonical: base },
	);
	const part = new DatabaseSync(atlasCachePartPath(root, "area-search"), {
		readOnly: true,
	});
	try {
		const stored = part
			.prepare("SELECT generation FROM cache_generation")
			.get()?.generation;
		// It names the inputs it was built from, not those of atlas.sqlite.
		assert.notEqual(stored, cacheGeneration(root, "area-search"));
		assert.equal(stored, cacheGeneration(root, "area-search", base));
	} finally {
		part.close();
	}
});

test("a stamp is written in one step and replaced whole", () => {
	const { root } = fixture();
	writeStageStamp(root, "verify-x", { checked: "1" });
	writeStageStamp(root, "verify-x", { checked: "2" });
	assert.deepEqual(
		JSON.parse(readFileSync(stageStampPath(root, "verify-x"), "utf8")),
		{ checked: "2" },
	);
	assert.deepEqual(temporaryFiles(join(root, "data/build/.stamps")), []);
});
