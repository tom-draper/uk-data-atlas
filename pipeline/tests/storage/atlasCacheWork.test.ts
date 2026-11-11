import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { onTestFinished, test, vi } from "vitest";
import { CACHE_VERSION } from "@uk-data-atlas/atlas-db";
import {
	ATLAS_CACHE_WORK_ENV,
	atlasCacheWorkPath,
	discardAtlasCacheWork,
	publishAtlasCache,
	publishAtlasCacheSteps,
	publishAtlasCacheWork,
	publishCacheTables,
	stageStampPath,
	stampCacheStage,
} from "../../src/storage";
import {
	checkStagedComponents,
	stampAtlasCache,
} from "../../src/storage/stampAtlasCache";

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "atlas-cache-work-"));
	onTestFinished(() => {
		vi.unstubAllEnvs();
		rmSync(root, { recursive: true, force: true });
	});
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
	const place = (name = "Leeds") => {
		publishCacheTables(root, "place-index", {
			place_names: { columns: ["name TEXT"], rows: [[name]] },
		});
		return stampCacheStage(root, {
			stage: "place-index",
			component: "place-index",
			tables: ["place_names"],
		});
	};
	const search = (code = "E01") => {
		publishCacheTables(root, "area-search", {
			area_search_codes: { columns: ["code TEXT"], rows: [[code]] },
		});
		return stampCacheStage(root, {
			stage: "area-search-index",
			component: "area-search",
			tables: ["area_search_codes"],
		});
	};
	const tablesIn = (path: string) => {
		const database = new DatabaseSync(path, { readOnly: true });
		try {
			return database
				.prepare(
					"SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN ('place_names', 'area_search_codes') ORDER BY name",
				)
				.all()
				.map((row) => String(row.name));
		} finally {
			database.close();
		}
	};
	const stamp = (stage: string) =>
		JSON.parse(readFileSync(stageStampPath(root, stage), "utf8")) as Record<
			string,
			string
		>;
	return { root, published, work, place, search, tablesIn, stamp };
}

test("run by hand, a cache stage publishes its own change", () => {
	const { published, work, place, tablesIn } = fixture();
	place();
	assert.deepEqual(tablesIn(published), ["place_names"]);
	assert.equal(existsSync(work), false);
});

test("in a data build, stages share one working copy and leave the published cache alone", () => {
	const { root, published, work, place, search, tablesIn } = fixture();
	place();
	const before = readFileSync(published);
	vi.stubEnv(ATLAS_CACHE_WORK_ENV, "1");
	search();
	assert.deepEqual(readFileSync(published), before);
	assert.deepEqual(tablesIn(published), ["place_names"]);
	// The working copy started from the published file, so it has both.
	assert.deepEqual(tablesIn(work), ["area_search_codes", "place_names"]);
	const created = statSync(work).ino;
	place("York");
	assert.equal(statSync(work).ino, created);
	assert.deepEqual(readFileSync(published), before);

	assert.equal(publishAtlasCacheWork(root), true);
	assert.equal(existsSync(work), false);
	assert.deepEqual(tablesIn(published), ["area_search_codes", "place_names"]);
	const cache = new DatabaseSync(published, { readOnly: true });
	try {
		assert.equal(
			cache.prepare("SELECT name FROM place_names").get()?.name,
			"York",
		);
		// The id that marks the copy does not outlive it.
		assert.equal(
			cache
				.prepare(
					"SELECT value FROM meta WHERE key = 'atlas-cache-work'",
				)
				.get(),
			undefined,
		);
	} finally {
		cache.close();
	}
	assert.equal(publishAtlasCacheWork(root), false);
});

test("a stage's stamp changes with each working copy even when its tables do not", () => {
	const { root, place, stamp } = fixture();
	vi.stubEnv(ATLAS_CACHE_WORK_ENV, "1");
	place();
	const first = stamp("place-index");
	place();
	// Same copy, same id: the stage reran inside one build.
	assert.deepEqual(stamp("place-index"), first);
	publishAtlasCacheWork(root);
	place();
	const third = stamp("place-index");
	assert.equal(third.content, first.content);
	assert.notEqual(third.session, first.session);
});

test("a stage that fails drops the working copy and never touches the published cache", () => {
	const { root, published, work, place, search, tablesIn } = fixture();
	place();
	const before = readFileSync(published);
	vi.stubEnv(ATLAS_CACHE_WORK_ENV, "1");
	search();
	assert.equal(existsSync(work), true);
	assert.throws(
		() =>
			publishAtlasCache(root, "area-search", (database) => {
				database.exec("CREATE TABLE half (x TEXT)");
				throw new Error("stage failed");
			}),
		/stage failed/,
	);
	assert.equal(existsSync(work), false);
	assert.deepEqual(readFileSync(published), before);
	// The stamp of the stage that wrote to the copy goes with it. The one made
	// by hand, before the build, held its tables in the published file.
	assert.equal(existsSync(stageStampPath(root, "area-search-index")), false);
	assert.equal(existsSync(stageStampPath(root, "place-index")), true);
	// The next stage starts again from the published file.
	publishAtlasCache(root, "place-index", (database) =>
		database.exec(
			"DROP TABLE IF EXISTS place_names; CREATE TABLE place_names (name TEXT)",
		),
	);
	assert.deepEqual(tablesIn(work), ["place_names"]);
});

test("publishing refuses a stamp whose tables were lost with a working copy", () => {
	const { root, published, work, place, search } = fixture();
	vi.stubEnv(ATLAS_CACHE_WORK_ENV, "1");
	place();
	search();
	// The copy that held both is lost; a later stage starts a new one.
	rmSync(work);
	place("York");
	assert.throws(
		() => checkStagedComponents(root),
		/no current area-search tables/,
	);
	assert.equal(existsSync(stageStampPath(root, "area-search-index")), false);
	assert.equal(existsSync(published), false);
});

test("a copy left by a build that stopped is discarded with the stamps that vouch for it", () => {
	const { root, published, work, place, search, stamp } = fixture();
	place();
	const before = readFileSync(published);
	vi.stubEnv(ATLAS_CACHE_WORK_ENV, "1");
	search();
	assert.ok(stamp("area-search-index"));
	assert.equal(discardAtlasCacheWork(root), true);
	assert.equal(existsSync(work), false);
	assert.equal(existsSync(stageStampPath(root, "area-search-index")), false);
	// A stamp from before the copy was made vouches for published tables.
	assert.ok(stamp("place-index"));
	assert.deepEqual(readFileSync(published), before);
	// A copy that cannot be read takes every stamp with it.
	search();
	writeFileSync(work, "not a database");
	assert.equal(discardAtlasCacheWork(root), true);
	assert.equal(existsSync(stageStampPath(root, "place-index")), false);
	assert.equal(existsSync(stageStampPath(root, "area-search-index")), false);
	// With no copy there is nothing to discard, and stamps are kept.
	vi.unstubAllEnvs();
	place();
	assert.equal(discardAtlasCacheWork(root), false);
	assert.ok(stamp("place-index"));
});

test("stamping publishes the working copy once, with the content hash", () => {
	const { root, published, work, place, search, tablesIn, stamp } = fixture();
	vi.stubEnv(ATLAS_CACHE_WORK_ENV, "1");
	place();
	search();
	assert.equal(existsSync(published), false);
	// Only the two cache stages are staged here; the third is not under test.
	assert.throws(() => checkStagedComponents(root), /postcode-counts/);
	publishAtlasCache(root, "postcode-counts", (database) =>
		database.exec("CREATE TABLE postcode_counts (x TEXT)"),
	);
	checkStagedComponents(root);
	const hash = stampAtlasCache(root);
	assert.equal(existsSync(work), false);
	assert.deepEqual(tablesIn(published), ["area_search_codes", "place_names"]);
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
	} finally {
		cache.close();
	}
	assert.equal(stamp("atlas-cache-stamp")["atlas-sqlite-content-hash"], hash);
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
		{ defer: false, vacuum: false },
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
		const { published, work, place, search, tablesIn } = fixture();
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
		place();
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
		// The build's working copy starts from an empty file the same way.
		rmSync(published);
		const stale = new DatabaseSync(published);
		stale.exec(
			[
				"CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID",
				version,
				"CREATE TABLE leftover (code TEXT)",
			].join(";"),
		);
		stale.close();
		vi.stubEnv(ATLAS_CACHE_WORK_ENV, "1");
		search();
		const copy = new DatabaseSync(work, { readOnly: true });
		try {
			assert.equal(
				copy
					.prepare(
						"SELECT count(*) AS n FROM sqlite_schema WHERE name = 'leftover'",
					)
					.get()?.n,
				0,
			);
		} finally {
			copy.close();
		}
		assert.deepEqual(tablesIn(work), ["area_search_codes"]);
	});
}

test("a cache stored with the current version keeps its other components", () => {
	const { published, place, search, tablesIn } = fixture();
	place();
	search();
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

const temporaryFiles = (directory: string) =>
	readdirSync(directory).filter((name) => name.endsWith(".tmp"));
