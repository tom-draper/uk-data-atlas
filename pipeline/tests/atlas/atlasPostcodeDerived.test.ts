import { resolve as resolveRepositoryRoot } from "node:path";
import { compilePostcodeAreas } from "../../src/postcodes/postcodeAreaCompiler";
import { atlasCachePath } from "@uk-data-atlas/atlas-db";
import assert from "node:assert/strict";
import {
	copyFileSync,
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
import { test, type TestContext } from "vitest";
import { artifactDirectory } from "@uk-data-atlas/atlas-db";
import { AREAS_VIEW } from "../../src/storage";
import { IdRegistries, idDirectory } from "../../src/ids/idRegistries";
import { seedIdRegistries } from "../../src/ids/seedIds";
import { sha256 } from "@uk-data-atlas/artifacts";
import type { PostcodeAreasShard } from "@uk-data-atlas/postcodes";
import { readAtlasPayload } from "@uk-data-atlas/catalogue/node";
import { storePostcodeIndex } from "../../src/postcodes/storePostcodeIndex";
import { assembleAtlas } from "../../src/atlas/assembleAtlas";
import { writeEmptyPostcodeAreas } from "../fixtures/atlasComponentFixtures";
import { storePostcodeAreas as writePostcodeAreas } from "../../src/postcodes/storePostcodeAreas";
import { buildDuckdbPostcodeCounts } from "../../src/postcode-counts/buildDuckdbPostcodeCounts";
import { validateShards } from "../../src/postcode-counts/validatePostcodeCountInputs";
import {
	readSqlitePostcodeAreas,
	readSqlitePostcodeAreaShard,
	readSqlitePostcodeCounts,
} from "@uk-data-atlas/postcodes";
import {
	readPostcodeCounts,
	readPostcodeAreaIndex,
	readPostcodeIndex,
} from "@uk-data-atlas/atlas-loader";
import { PostcodeAreaIndex, NONE, SEVERAL } from "@uk-data-atlas/postcodes";
import { postcodeIndexFor, postcodeRow } from "../fixtures/postcodeFixtures";

/**
 * The fixture's base database is written by hand, so its ids are registered
 * from it, as they would be from a build's.
 */
const registerBaseIds = (root: string) => {
	const directory = idDirectory(root);
	rmSync(directory, { recursive: true, force: true });
	const ids = IdRegistries.load(directory);
	const base = new DatabaseSync(join(root, "data/build/atlas-base.sqlite"), {
		readOnly: true,
	});
	try {
		seedIdRegistries(base, ids, { fillGaps: true });
	} finally {
		base.close();
	}
	ids.save();
};

const storePostcodeAreas: typeof writePostcodeAreas = (
	root,
	artifact,
	readShard,
) => {
	writePostcodeAreas(root, artifact, readShard);
	registerBaseIds(root);
	return assembleAtlas(root, { crosswalkWeights: false });
};

function fixture(t: TestContext) {
	const root = mkdtempSync(join(tmpdir(), "atlas-postcode-derived-"));
	t.onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const apiRoot = join(root, "services/api");
	mkdirSync(join(root, "data/build"), { recursive: true });
	mkdirSync(
		join(
			artifactDirectory(resolveRepositoryRoot(apiRoot, "../..")),
			"postcode-areas",
		),
		{
			recursive: true,
		},
	);
	const path = join(root, "data/build/atlas.sqlite");
	const db = new DatabaseSync(path);
	db.exec(
		`CREATE TABLE payloads (id TEXT PRIMARY KEY, payload TEXT NOT NULL) WITHOUT ROWID;
		INSERT INTO payloads VALUES ('existing', 'retained');
		CREATE TABLE area_releases (id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
		INSERT INTO area_releases VALUES (0, 'ward', '2026');
		CREATE TABLE geography (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE);
		INSERT INTO geography VALUES (1, 'ward');
		CREATE TABLE area (id INTEGER PRIMARY KEY, geography_id INTEGER NOT NULL REFERENCES geography(id), code TEXT NOT NULL, UNIQUE(code, geography_id));
		INSERT INTO area VALUES (1, 1, 'A');
		CREATE TABLE area_version (id INTEGER PRIMARY KEY, area_id INTEGER NOT NULL REFERENCES area(id), release_id INTEGER NOT NULL REFERENCES area_releases(id), name TEXT NOT NULL, area_m2 REAL, population REAL, aliases TEXT, in_inventory INTEGER NOT NULL, UNIQUE(release_id, area_id));
		INSERT INTO area_version VALUES (1, 1, 0, 'Area A', NULL, NULL, NULL, 1);
		CREATE VIEW areas AS ${AREAS_VIEW};`,
	);
	db.close();
	copyFileSync(
		join(root, "data/build/atlas.sqlite"),
		join(root, "data/build/atlas-base.sqlite"),
	);
	writeFileSync(join(root, "data/build/geography-payloads.json"), "[]");
	const postcodes = postcodeIndexFor([
		postcodeRow("M1 1AA", { usrtypind: "1" }),
		postcodeRow("M1 1AB", { doterm: "200102" }),
		postcodeRow("SW1A 1AA", { east1m: "", north1m: "", gridind: "9" }),
	]);
	storePostcodeIndex(root, postcodes.artifact, (path) =>
		postcodes.texts.get(path)!,
	);
	writeEmptyPostcodeAreas(root);
	registerBaseIds(root);
	assembleAtlas(root, { crosswalkWeights: false });
	const compiled = compilePostcodeAreas(postcodes.artifact, [
		{
			release: {
				geography: "ward",
				boundaryRelease: "2026",
				purposes: ["default-lookup"],
				areaRelease: "areas",
				geometryInput: "geometry",
				counts: { placed: 2, unplaced: 0, several: 1 },
			},
			placements: {
				codes: ["A", "B"],
				area: Int32Array.from([0, SEVERAL, NONE]),
				distanceCm: Int32Array.from([1234, 0, 0]),
				several: new Map([
					[
						1,
						[
							[0, "boundary", 0],
							[1, "interior", 42],
						],
					],
				]),
			},
		},
	]);
	const texts = new Map(compiled.files.map((file) => [file.path, file.text]));
	return { root, apiRoot, path, compiled, texts };
}

test("postcode index readers work from the component without an atlas database", (t) => {
	const { root, path } = fixture(t);
	rmSync(path);
	const count = readPostcodeIndex(
		root,
		join(root, "data/build/postcode-index.sqlite"),
	).artifact.counts.postcodes;
	assert.equal(count, 3);
});

test("postcode area component leaves the published database unchanged", (t) => {
	const { root, path, compiled, texts } = fixture(t);
	const before = readFileSync(path);
	const manifest = writePostcodeAreas(root, compiled.artifact, (name) =>
		texts.get(name)!,
	);
	assert.deepEqual(readFileSync(path), before);
	assert.deepEqual(
		JSON.parse(readFileSync(manifest, "utf8")),
		compiled.artifact,
	);
});

test("a corrupt postcode area component does not replace the published database", (t) => {
	const { root, path, compiled, texts } = fixture(t);
	writePostcodeAreas(root, compiled.artifact, (name) => texts.get(name)!);
	const before = readFileSync(path);
	const shard = compiled.artifact.shards[0]!;
	writeFileSync(
		join(root, "data/build/postcode-areas-component", `${shard.path}.gz`),
		"corrupt",
	);
	assert.throws(() => assembleAtlas(root, { crosswalkWeights: false }));
	assert.deepEqual(readFileSync(path), before);
});

test("readers refuse a database built before postcode area sets", (t) => {
	const { root, path, compiled, texts } = fixture(t);
	storePostcodeAreas(root, compiled.artifact, (name) => texts.get(name)!);
	const file = compiled.files[0]!.path;
	assert.equal(
		readSqlitePostcodeAreaShard(root, file),
		compiled.files[0]!.text,
	);
	const db = new DatabaseSync(path);
	db.exec("DELETE FROM meta WHERE key = 'postcodeAreaLayout'");
	db.close();
	assert.throws(
		() => readSqlitePostcodeAreaShard(root, file),
		/postcode area layout 1 but this code needs 3/,
	);
});

test("SQLite mappings retain exact bytes, boundary matches, distances and empty placements without JSON", (t) => {
	const { root, apiRoot, path, compiled, texts } = fixture(t);
	mkdirSync(
		join(
			artifactDirectory(resolveRepositoryRoot(apiRoot, "../..")),
			"postcode-areas",
		),
		{
			recursive: true,
		},
	);
	writeFileSync(
		join(
			artifactDirectory(resolveRepositoryRoot(apiRoot, "../..")),
			"postcode-areas.json",
		),
		"obsolete",
	);
	writeFileSync(
		join(
			artifactDirectory(resolveRepositoryRoot(apiRoot, "../..")),
			"postcode-areas/obsolete.json.gz",
		),
		"obsolete",
	);
	for (let run = 0; run < 2; run++)
		storePostcodeAreas(root, compiled.artifact, (path) => texts.get(path)!);
	assembleAtlas(root, { crosswalkWeights: false });
	assert.equal(readAtlasPayload(root, "existing"), "retained");
	// Assembled payloads are stored compressed and read back as the text.
	const assembled = new DatabaseSync(path, { readOnly: true });
	assert.deepEqual(
		assembled
			.prepare(
				"SELECT id, typeof(payload) AS type FROM payloads WHERE id LIKE 'postcode-%' ORDER BY id",
			)
			.all()
			.map((row) => ({ ...row })),
		[
			{ id: "postcode-areas", type: "blob" },
			{ id: "postcode-index", type: "blob" },
		],
	);
	assembled.close();
	assert.equal(
		JSON.parse(readAtlasPayload(root, "postcode-index")).contentHash,
		compiled.artifact.postcodeIndex,
	);
	assert.equal(
		existsSync(
			join(
				artifactDirectory(resolveRepositoryRoot(apiRoot, "../..")),
				"postcode-areas.json",
			),
		),
		false,
	);
	assert.equal(
		existsSync(
			join(
				artifactDirectory(resolveRepositoryRoot(apiRoot, "../..")),
				"postcode-areas",
			),
		),
		false,
	);
	assert.deepEqual(readSqlitePostcodeAreas(root), compiled.artifact);
	const db = new DatabaseSync(path);
	assert.deepEqual(
		{
			...db
				.prepare(
					"SELECT p.postcode, a.code, a.name FROM postcodes p JOIN postcode_area_set s ON s.id = p.area_set_id JOIN areas a ON a.id = s.wardAreaId",
				)
				.get(),
		},
		{ postcode: "M11AA", code: "A", name: "Area A" },
	);
	assert.equal(
		db.prepare("SELECT inInventory FROM areas WHERE code = 'B'").get()!
			.inInventory,
		0,
	);
	assert.equal(
		db
			.prepare(
				"SELECT wardCode FROM postcodes_decoded WHERE postcode = 'M11AA'",
			)
			.get()!.wardCode,
		"A",
	);
	// Postcodes with the same areas share one numbered set, first seen first.
	assert.deepEqual(
		db
			.prepare("SELECT id, wardAreaId FROM postcode_area_set ORDER BY id")
			.all()
			.map((row) => ({ ...row })),
		[
			{ id: 1, wardAreaId: 1 },
			{ id: 2, wardAreaId: null },
		],
	);
	assert.deepEqual(
		db
			.prepare(
				"SELECT postcode, area_set_id FROM postcodes ORDER BY postcode",
			)
			.all()
			.map((row) => ({ ...row })),
		[
			{ postcode: "M11AA", area_set_id: 1 },
			{ postcode: "M11AB", area_set_id: 2 },
			{ postcode: "SW1A1AA", area_set_id: 2 },
		],
	);
	assert.equal(
		db
			.prepare(
				"SELECT strict FROM pragma_table_list WHERE name = 'postcode_area_set'",
			)
			.get()!.strict,
		1,
	);
	assert.deepEqual(
		db
			.prepare("SELECT name FROM pragma_table_info('postcodes_decoded')")
			.all()
			.map((row) => row.name),
		[
			"postcode",
			"easting",
			"northing",
			"quality",
			"country",
			"introduced",
			"terminated",
			"largeUser",
			"wardAreaId",
			"wardDistanceCm",
			"wardCode",
		],
	);
	assert.deepEqual(
		{
			...db
				.prepare(
					"SELECT wardAreaId, wardDistanceCm FROM postcodes_decoded WHERE postcode = 'M11AA'",
				)
				.get(),
		},
		{ wardAreaId: 1, wardDistanceCm: 1234 },
	);
	assert.equal(
		db
			.prepare("SELECT count(*) AS n FROM postcode_area_matches_decoded")
			.get()!.n,
		2,
	);
	assert.equal(
		db
			.prepare(
				"SELECT count(*) AS n FROM sqlite_schema WHERE name = 'postcode_area_shards'",
			)
			.get()!.n,
		0,
	);
	assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
	db.close();
	for (const file of compiled.files)
		assert.equal(readSqlitePostcodeAreaShard(root, file.path), file.text);
	const inventory = {
		schemaVersion: 1 as const,
		contentHash: "inventory",
		boundaryRegistryHash: "registry",
		releases: [
			{
				id: "2026",
				geography: "ward",
				status: "available" as const,
				recordCount: 2,
				artifact: "unused",
				contentHash: "areas",
				codeProperty: "code",
				nameProperty: "name",
			},
		],
	};
	const geometry = new Map([
		[
			"ward/2026",
			{
				input: "unused",
				inputHash: "geometry",
				crs: "EPSG:4326",
				codeProperty: "code",
			},
		],
	]);
	const postcodes = readPostcodeIndex(root);
	const index = readPostcodeAreaIndex(root, postcodes, inventory, geometry);
	assert.throws(
		() =>
			readPostcodeAreaIndex(
				root,
				postcodes,
				{
					...inventory,
					releases: inventory.releases.map((release) => ({
						...release,
						contentHash: "stale",
					})),
				},
				geometry,
			),
		/current areas/,
	);
	assert.throws(
		() => readPostcodeAreaIndex(root, postcodes, inventory, new Map()),
		/current geometry/,
	);
	assert.deepEqual(index.containing("M11AA", "ward", "2026"), [
		{ code: "A", containment: "interior", distanceToBoundaryM: 12.34 },
	]);
	assert.deepEqual(index.containing("M11AB", "ward", "2026"), [
		{ code: "A", containment: "boundary", distanceToBoundaryM: 0 },
		{ code: "B", containment: "interior", distanceToBoundaryM: 0.42 },
	]);
	assert.deepEqual(index.containing("SW1A1AA", "ward", "2026"), []);
	assert.equal(index.containing("ZZ11AA", "ward", "2026"), undefined);
	assert.equal(index.containing("M11AA", "ward", "unknown"), undefined);
});

test("counts build entirely from SQLite, preserve zero and uncovered results, and reject corruption and stale inputs", async (t) => {
	const { root, apiRoot, path, compiled, texts } = fixture(t);
	storePostcodeAreas(root, compiled.artifact, (path) => texts.get(path)!);
	assert.deepEqual(validateShards(root).areas, compiled.artifact);
	writeFileSync(
		join(
			artifactDirectory(resolveRepositoryRoot(apiRoot, "../..")),
			"postcode-counts.json",
		),
		"obsolete",
	);
	const built = await buildDuckdbPostcodeCounts(root);
	assert.equal(built.countedAreas, 2);
	assert.deepEqual(readSqlitePostcodeCounts(root), built.artifact);
	assert.equal(
		existsSync(
			join(
				artifactDirectory(resolveRepositoryRoot(apiRoot, "../..")),
				"postcode-counts.json",
			),
		),
		false,
	);
	const postcodes = readPostcodeIndex(root);
	const areas = new PostcodeAreaIndex(compiled.artifact, postcodes, (path) =>
		readSqlitePostcodeAreaShard(root, path),
	);
	const counts = readPostcodeCounts(root, postcodes, areas);
	assert.deepEqual(counts.forArea("ward", "2026", "A"), {
		live: 1,
		terminated: 1,
		largeUser: 1,
		edition: "2026-08",
	});
	assert.deepEqual(counts.forArea("ward", "2026", "B"), {
		live: 0,
		terminated: 1,
		largeUser: 0,
		edition: "2026-08",
	});
	assert.deepEqual(counts.forArea("ward", "2026", "empty"), {
		live: 0,
		terminated: 0,
		largeUser: 0,
		edition: "2026-08",
	});
	assert.equal(counts.forArea("ward", "unknown", "A"), undefined);
	const stale = new PostcodeAreaIndex(
		{ ...compiled.artifact, contentHash: "stale" },
		postcodes,
		() => "",
	);
	assert.throws(
		() => readPostcodeCounts(root, postcodes, stale),
		/current postcode area index/,
	);
	const db = new DatabaseSync(atlasCachePath(root));
	db.exec("UPDATE postcode_counts SET live = 99");
	db.close();
	assert.throws(
		() => readPostcodeCounts(root, postcodes, areas),
		/content hash/,
	);
});

test("failed mapping replacements preserve the published database and old files; missing SQLite has no JSON fallback", (t) => {
	const { root, apiRoot, path, compiled, texts } = fixture(t);
	storePostcodeAreas(root, compiled.artifact, (path) => texts.get(path)!);
	const before = readFileSync(path);
	writeFileSync(
		join(
			artifactDirectory(resolveRepositoryRoot(apiRoot, "../..")),
			"postcode-areas.json",
		),
		JSON.stringify(compiled.artifact),
	);
	assert.throws(
		() => storePostcodeAreas(root, compiled.artifact, () => "corrupt"),
		/Invalid postcode area shard/,
	);
	assert.deepEqual(readFileSync(path), before);
	assert.equal(
		existsSync(
			join(
				artifactDirectory(resolveRepositoryRoot(apiRoot, "../..")),
				"postcode-areas.json",
			),
		),
		true,
	);
	rmSync(path);
	assert.throws(() => readSqlitePostcodeAreas(root));
});

test("stored area corruption fails the shard hash check", (t) => {
	const { root, apiRoot, path, compiled, texts } = fixture(t);
	storePostcodeAreas(root, compiled.artifact, (path) => texts.get(path)!);
	const db = new DatabaseSync(path);
	db.exec(
		"UPDATE postcodes SET wardDistanceCm = 99 WHERE postcode = 'M11AA'",
	);
	db.close();
	assert.throws(
		() =>
			readSqlitePostcodeAreaShard(
				root,
				compiled.artifact.shards[0]!.path,
			),
		/Invalid SQLite postcode area shard/,
	);
});

test("repeated geographies use exact releases and preserve shard release order", (t) => {
	const { root, apiRoot, path, compiled } = fixture(t);
	const db = new DatabaseSync(join(root, "data/build/atlas-base.sqlite"));
	db.exec(
		"INSERT INTO area_releases VALUES (1, 'ward', '2025'); INSERT INTO area_version VALUES (3, 1, 1, 'Old area A', NULL, NULL, NULL, 1)",
	);
	db.close();
	const files = new Map(
		compiled.files.map((file) => {
			const shard: PostcodeAreasShard = JSON.parse(file.text);
			shard.releases["ward/2025"] = shard.releases["ward/2026"]!;
			return [file.path, JSON.stringify(shard) + "\n"];
		}),
	);
	const artifact = {
		...compiled.artifact,
		releases: [
			{ ...compiled.artifact.releases[0]!, boundaryRelease: "2025" },
			...compiled.artifact.releases,
		],
		shards: compiled.artifact.shards.map((entry) => ({
			...entry,
			contentHash: sha256(files.get(entry.path)!),
		})),
	};
	storePostcodeAreas(root, artifact, (path) => files.get(path)!);
	for (const entry of artifact.shards)
		assert.equal(
			readSqlitePostcodeAreaShard(root, entry.path),
			files.get(entry.path),
		);
	const after = new DatabaseSync(path);
	assert.equal(
		after
			.prepare(
				'SELECT s."ward_2025AreaId" AS old, s."ward_2026AreaId" AS current FROM postcodes p JOIN postcode_area_set s ON s.id = p.area_set_id WHERE p.postcode = ?',
			)
			.get("M11AA")!.old,
		3,
	);
	assert.equal(
		after
			.prepare(
				'SELECT s."ward_2025AreaId" AS old, s."ward_2026AreaId" AS current FROM postcodes p JOIN postcode_area_set s ON s.id = p.area_set_id WHERE p.postcode = ?',
			)
			.get("M11AA")!.current,
		1,
	);
	assert.deepEqual(after.prepare("PRAGMA foreign_key_check").all(), []);
	after.close();
});

test("a release stores null where an earlier release has the same distance", (t) => {
	const { root, path, compiled } = fixture(t);
	const db = new DatabaseSync(join(root, "data/build/atlas-base.sqlite"));
	db.exec(
		"INSERT INTO area_releases VALUES (1, 'ward', '2024'), (2, 'ward', '2025'); INSERT INTO area_version VALUES (3, 1, 1, 'Old A', NULL, NULL, NULL, 1), (4, 1, 2, 'Older A', NULL, NULL, NULL, 1)",
	);
	db.close();
	const files = new Map(
		compiled.files.map((file) => {
			const shard: PostcodeAreasShard = JSON.parse(file.text);
			const current = shard.releases["ward/2026"]!;
			// 2024 differs, 2025 and 2026 match, and the rest is zero.
			shard.releases["ward/2024"] = {
				...current,
				distanceCm: current.distanceCm.map((cm) =>
					cm === 1234 ? 999 : cm,
				),
			};
			shard.releases["ward/2025"] = current;
			return [file.path, JSON.stringify(shard) + "\n"];
		}),
	);
	const base = compiled.artifact.releases[0]!;
	const artifact = {
		...compiled.artifact,
		releases: [
			{ ...base, boundaryRelease: "2024" },
			{ ...base, boundaryRelease: "2025" },
			base,
		],
		shards: compiled.artifact.shards.map((entry) => ({
			...entry,
			contentHash: sha256(files.get(entry.path)!),
		})),
	};
	storePostcodeAreas(root, artifact, (name) => files.get(name)!);
	for (const entry of artifact.shards)
		assert.equal(
			readSqlitePostcodeAreaShard(root, entry.path),
			files.get(entry.path),
		);
	const after = new DatabaseSync(path);
	assert.deepEqual(
		after
			.prepare(
				"SELECT position, distanceFallback FROM postcode_area_releases ORDER BY position",
			)
			.all()
			.map((row) => ({ ...row })),
		[
			{ position: 0, distanceFallback: null },
			{ position: 1, distanceFallback: null },
			{ position: 2, distanceFallback: 1 },
		],
	);
	// Stored: only the repeated, nonzero distance is null.
	assert.deepEqual(
		{
			...after
				.prepare(
					'SELECT "ward_2024DistanceCm" AS a, "ward_2025DistanceCm" AS b, "ward_2026DistanceCm" AS c FROM postcodes WHERE postcode = ?',
				)
				.get("M11AA"),
		},
		{ a: 999, b: 1234, c: null },
	);
	assert.deepEqual(
		{
			...after
				.prepare(
					'SELECT "ward_2026DistanceCm" AS c FROM postcodes WHERE postcode = ?',
				)
				.get("M11AB"),
		},
		{ c: 0 },
	);
	// The decoded view still shows every distance.
	assert.deepEqual(
		{
			...after
				.prepare(
					'SELECT "ward_2024DistanceCm" AS a, "ward_2025DistanceCm" AS b, "ward_2026DistanceCm" AS c FROM postcodes_decoded WHERE postcode = ?',
				)
				.get("M11AA"),
		},
		{ a: 999, b: 1234, c: 1234 },
	);
	after.close();
});
