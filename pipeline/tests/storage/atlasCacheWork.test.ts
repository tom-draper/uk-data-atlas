import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { onTestFinished, test } from "vitest";
import { atlasCachePartPath, CACHE_VERSION } from "@uk-data-atlas/atlas-db";
import {
	atlasCacheWorkPath,
	discardAtlasCacheWork,
	publishAtlasCacheSteps,
	publishCacheTables,
	stageStampPath,
	writeCachePart,
	writeCacheTables,
	writeStageStamp,
} from "../../src/storage";
import {
	checkStagedComponents,
	stampAtlasCache,
} from "../../src/storage/stampAtlasCache";

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "atlas-cache-work-"));
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
	const published = join(root, "data/build/atlas-cache.sqlite");
	const work = atlasCacheWorkPath(root);
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
			postcode_counts: { columns: ["code TEXT"], rows: [["A"]] },
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
	return { root, published, work, place, search, counts, tablesIn };
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
					const canonical = new DatabaseSync(
						join(root, "data/build/atlas.sqlite"),
					);
					canonical.exec(
						"UPDATE area_inventory_metadata SET content_hash = 'areas-2'",
					);
					canonical.close();
				},
			}),
		/Canonical cache inputs changed/,
	);
	assert.equal(existsSync(atlasCachePartPath(root, "place-index")), false);
});

test("stamping copies every part into one working copy and publishes it once, with the content hash", () => {
	const { root, published, work, place, search, counts, tablesIn } =
		fixture();
	place();
	search();
	counts();
	checkStagedComponents(root);
	const hash = stampAtlasCache(root);
	assert.equal(existsSync(work), false);
	assert.deepEqual(tablesIn(published), [
		"area_search_codes",
		"place_names",
		"postcode_counts",
	]);
	const cache = new DatabaseSync(published, { readOnly: true });
	try {
		assert.equal(
			cache
				.prepare(
					"SELECT value FROM meta WHERE key = 'atlas-sqlite-content-hash'",
				)
				.get()?.value,
			hash,
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
	} finally {
		cache.close();
	}
	assert.deepEqual(
		JSON.parse(
			readFileSync(stageStampPath(root, "atlas-cache-stamp"), "utf8"),
		),
		{ "atlas-sqlite-content-hash": hash },
	);
	assert.deepEqual(temporaryFiles(join(root, "data/build")), []);
});

test("stamping is refused for a part that is missing or was built for other inputs", () => {
	const { root, place, search, counts } = fixture();
	place();
	search();
	assert.throws(() => checkStagedComponents(root), /postcode-counts/);
	counts();
	checkStagedComponents(root);
	rmSync(atlasCachePartPath(root, "area-search"));
	assert.throws(() => checkStagedComponents(root), /no current area-search/);
	search();
	const canonical = new DatabaseSync(join(root, "data/build/atlas.sqlite"));
	canonical.exec(
		"UPDATE payloads SET payload = 'releases-2' WHERE id = 'boundary-releases'",
	);
	canonical.close();
	assert.throws(() => checkStagedComponents(root), /no current place-index/);
});

test("a working copy left by a build that stopped is discarded", () => {
	const { root, published, work, place, search, counts } = fixture();
	place();
	search();
	counts();
	assert.equal(discardAtlasCacheWork(root), false);
	writeFileSync(work, "half a copy");
	assert.equal(discardAtlasCacheWork(root), true);
	assert.equal(existsSync(work), false);
	assert.equal(existsSync(published), false);
});

test("one copy takes several components and publishes them together", () => {
	const { root, published, tablesIn } = fixture();
	publishAtlasCacheSteps(
		root,
		[
			{
				component: "place-index",
				write: (database) =>
					database.exec("CREATE TABLE place_names (name TEXT)"),
			},
			{
				component: "area-search",
				write: (database) =>
					database.exec("CREATE TABLE area_search_codes (code TEXT)"),
			},
		],
		{ vacuum: false },
	);
	assert.deepEqual(tablesIn(published), ["area_search_codes", "place_names"]);
	const cache = new DatabaseSync(published, { readOnly: true });
	try {
		assert.deepEqual(
			cache
				.prepare(
					"SELECT component FROM cache_generation ORDER BY component",
				)
				.all()
				.map((row) => row.component),
			["area-search", "place-index"],
		);
	} finally {
		cache.close();
	}
	assert.deepEqual(
		temporaryFiles(join(root, "data/build")),
		[],
		"no temporary file is left behind",
	);
});

/** A published cache written under another version, or by code that stored none. */
const oldCaches = [
	[
		"an older version",
		`INSERT INTO meta VALUES ('cacheVersion', '${CACHE_VERSION - 1}')`,
	],
	["no version", "SELECT 1"],
] as const;

for (const [label, version] of oldCaches) {
	test(`a cache stored with ${label} is rebuilt from an empty file`, () => {
		const { root, published, tablesIn } = fixture();
		const old = new DatabaseSync(published);
		old.exec(
			[
				"CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID",
				version,
				// Tables under the retired names.
				"CREATE TABLE area_search_codes (code TEXT)",
				"CREATE TABLE place_index_places (name TEXT)",
				"CREATE TABLE cache_generations (component TEXT, generation TEXT)",
			].join(";"),
		);
		old.close();
		publishCacheTables(root, "place-index", {
			place_names: { columns: ["name TEXT"], rows: [["Leeds"]] },
		});
		assert.deepEqual(tablesIn(published), ["place_names"]);
		const cache = new DatabaseSync(published, { readOnly: true });
		try {
			assert.deepEqual(
				cache
					.prepare("SELECT key, value FROM meta ORDER BY key")
					.all()
					.map((row) => [row.key, row.value]),
				[["cacheVersion", String(CACHE_VERSION)]],
			);
			// Compatibility views for the retired names are not written.
			assert.equal(
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
	});
}

test("a cache stored with the current version keeps its other components", () => {
	const { root, published, tablesIn } = fixture();
	publishCacheTables(root, "place-index", {
		place_names: { columns: ["name TEXT"], rows: [["Leeds"]] },
	});
	publishCacheTables(root, "area-search", {
		area_search_codes: { columns: ["code TEXT"], rows: [["E01"]] },
	});
	const cache = new DatabaseSync(published, { readOnly: true });
	try {
		assert.equal(
			cache
				.prepare("SELECT value FROM meta WHERE key = 'cacheVersion'")
				.get()?.value,
			String(CACHE_VERSION),
		);
	} finally {
		cache.close();
	}
	assert.deepEqual(tablesIn(published), ["area_search_codes", "place_names"]);
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
