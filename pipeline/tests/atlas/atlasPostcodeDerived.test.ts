import { execFileSync } from "node:child_process";
import { resolve as resolveRepositoryRoot } from "node:path";
import { compilePostcodeAreas } from "../../src/postcodes/postcodeAreaCompiler";
import { atlasCachePartPath } from "@uk-data-atlas/atlas-db";
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
import { test, vi, type TestContext } from "vitest";
import { artifactDirectory } from "@uk-data-atlas/atlas-db";
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
import { parseLookupCoordinate } from "@uk-data-atlas/geography";

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
		CREATE TABLE area_release (id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
		INSERT INTO area_release VALUES (0, 'ward', '2026');
		CREATE TABLE geography (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE);
		INSERT INTO geography VALUES (1, 'ward');
		CREATE TABLE area (id INTEGER PRIMARY KEY, geography_id INTEGER NOT NULL REFERENCES geography(id), code TEXT NOT NULL, UNIQUE(code, geography_id));
		INSERT INTO area VALUES (1, 1, 'A');
		CREATE TABLE area_version (id INTEGER PRIMARY KEY, area_id INTEGER NOT NULL REFERENCES area(id), release_id INTEGER NOT NULL REFERENCES area_release(id), name TEXT NOT NULL, area_m2 REAL, population REAL, aliases TEXT, in_inventory INTEGER NOT NULL, UNIQUE(release_id, area_id));
		INSERT INTO area_version VALUES (1, 1, 0, 'Area A', NULL, NULL, NULL, 1);`,
	);
	db.close();
	copyFileSync(
		join(root, "data/build/atlas.sqlite"),
		join(root, "data/build/atlas-base.sqlite"),
	);
	writeFileSync(join(root, "data/build/geography-payloads.json"), "[]");
	writeFileSync(
		join(root, "data/build/statistics-read-path.json"),
		JSON.stringify({
			schemaVersion: 1,
			dataCatalogHash: "fixture",
			statistics: {},
			observations: {},
		}),
	);
	const postcodes = postcodeIndexFor([
		postcodeRow("M1 1AA", { usrtypind: "1" }),
		postcodeRow("M1 1AB", {
			doterm: "200102",
			east1m: "400000",
			north1m: "400000",
		}),
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
		{ standalone: true },
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
	const postcodeRows = db
		.prepare(
			"SELECT postcode, easting, northing, quality, country, introduced, terminated, largeUser FROM postcodes ORDER BY postcode",
		)
		.all();
	const coordinates = db
		.prepare(
			"SELECT latitude, longitude FROM postcodes_decoded ORDER BY postcode",
		)
		.all();
	for (const at of [0, 1]) {
		const row = postcodeRows[at]!;
		const point = parseLookupCoordinate("EPSG:27700", {
			easting: String(row.easting),
			northing: String(row.northing),
		})!;
		assert.deepEqual(
			[coordinates[at]!.longitude, coordinates[at]!.latitude],
			[point.lng, point.lat],
		);
	}
	assert.deepEqual(
		{ ...coordinates[2] },
		{ latitude: null, longitude: null },
	);
	db.exec("UPDATE meta SET value = '6' WHERE key = 'postcodeAreaLayout'");
	db.close();
	assert.throws(
		() => readSqlitePostcodeAreaShard(root, file),
		/postcode area layout 6 but this code needs 8/,
	);
});

test("SQLite mappings retain boundary matches, distances and empty placements without JSON", (t) => {
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
					"SELECT p.postcode, a.code, v.name FROM postcodes p JOIN postcode_area_set s ON s.id = p.area_set_id JOIN area_version v ON v.id = s.ward_area_id JOIN area a ON a.id = v.area_id",
				)
				.get(),
		},
		{ postcode: "M11AA", code: "A", name: "Area A" },
	);
	assert.equal(
		db
			.prepare(
				"SELECT v.in_inventory AS inInventory FROM area_version v JOIN area a ON a.id = v.area_id WHERE a.code = 'B'",
			)
			.get()!.inInventory,
		0,
	);
	assert.equal(
		db
			.prepare(
				"SELECT ward_code FROM postcodes_decoded WHERE postcode = 'M11AA'",
			)
			.get()!.ward_code,
		"A",
	);
	// Postcodes with the same areas share one numbered set, first seen first.
	assert.deepEqual(
		db
			.prepare(
				"SELECT id, ward_area_id FROM postcode_area_set ORDER BY id",
			)
			.all()
			.map((row) => ({ ...row })),
		[
			{ id: 1, ward_area_id: 1 },
			{ id: 2, ward_area_id: null },
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
	for (const name of [
		"postcodes",
		"postcode_area_release",
		"postcode_area_match",
		"postcode_area_set",
		"postcode_area_shard_hash",
	]) {
		assert.equal(
			db
				.prepare("SELECT strict FROM pragma_table_list WHERE name = ?")
				.get(name)!.strict,
			1,
			name,
		);
	}
	assert.throws(() =>
		db
			.prepare("UPDATE postcodes SET easting = ? WHERE postcode = ?")
			.run("invalid", "M11AA"),
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
			"latitude",
			"longitude",
			"ward_area_id",
			"ward_distance_cm",
			"ward_code",
		],
	);
	assert.deepEqual(
		{
			...db
				.prepare(
					"SELECT ward_area_id, ward_distance_cm FROM postcodes_decoded WHERE postcode = 'M11AA'",
				)
				.get(),
		},
		{ ward_area_id: 1, ward_distance_cm: 1234 },
	);
	assert.equal(
		db
			.prepare("SELECT count(*) AS n FROM postcode_area_match_decoded")
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
	const built = await buildDuckdbPostcodeCounts(root);
	assert.equal(built.countedAreas, 2);
	assert.deepEqual(readSqlitePostcodeCounts(root), built.artifact);
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
	const db = new DatabaseSync(atlasCachePartPath(root, "postcode-counts"));
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

test("derived shards use canonical code order without preserving unused dictionary entries", (t) => {
	const { root, path, compiled } = fixture(t);
	const files = new Map(
		compiled.files.map((file) => {
			const shard: PostcodeAreasShard = JSON.parse(file.text);
			for (const column of Object.values(shard.releases)) {
				if (column.codes.length !== 2) continue;
				column.codes.reverse();
				column.area = column.area.map((value) =>
					value >= 0 ? 1 - value : value,
				);
				for (const matches of Object.values(column.several ?? {}))
					for (const match of matches) match[0] = 1 - match[0];
			}
			return [file.path, JSON.stringify(shard) + "\n"];
		}),
	);
	const artifact = {
		...compiled.artifact,
		shards: compiled.artifact.shards.map((entry) => ({
			...entry,
			contentHash: sha256(files.get(entry.path)!),
		})),
	};
	storePostcodeAreas(root, artifact, (name) => files.get(name)!);
	const entry = artifact.shards[0]!;
	const derived = JSON.parse(
		readSqlitePostcodeAreaShard(root, entry.path),
	) as PostcodeAreasShard;
	assert.deepEqual(derived.releases["ward/2026"]!.codes, ["A", "B"]);
	assert.deepEqual(derived.releases["ward/2026"]!.area, [0, SEVERAL]);
	assert.notEqual(sha256(JSON.stringify(derived) + "\n"), entry.contentHash);
	const postcodes = readPostcodeIndex(root);
	const index = new PostcodeAreaIndex(
		artifact,
		postcodes,
		(name) => readSqlitePostcodeAreaShard(root, name),
		256,
		false,
	);
	assert.deepEqual(index.containing("M11AA", "ward", "2026"), [
		{ code: "A", containment: "interior", distanceToBoundaryM: 12.34 },
	]);
	const db = new DatabaseSync(path);
	assert.equal(
		db
			.prepare(
				"SELECT count(*) AS n FROM sqlite_schema WHERE name IN ('postcode_area_codes', 'postcode_area_columns')",
			)
			.get()!.n,
		0,
	);
	db.close();
});

test("stored area corruption fails the shard hash check", (t) => {
	const { root, apiRoot, path, compiled, texts } = fixture(t);
	storePostcodeAreas(root, compiled.artifact, (path) => texts.get(path)!);
	const db = new DatabaseSync(path);
	db.exec(
		"UPDATE postcodes SET ward_distance_cm = 99 WHERE postcode = 'M11AA'",
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

test("repeated geographies use exact releases and canonical release order", (t) => {
	const { root, apiRoot, path, compiled } = fixture(t);
	const db = new DatabaseSync(join(root, "data/build/atlas-base.sqlite"));
	db.exec(
		"INSERT INTO area_release VALUES (1, 'ward', '2025'); INSERT INTO area_version VALUES (3, 1, 1, 'Old area A', NULL, NULL, NULL, 1)",
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
		assert.deepEqual(
			JSON.parse(readSqlitePostcodeAreaShard(root, entry.path)),
			JSON.parse(files.get(entry.path)!),
		);
	const after = new DatabaseSync(path);
	assert.equal(
		after
			.prepare(
				"SELECT s.ward_2025_area_id AS old, s.ward_2026_area_id AS current FROM postcodes p JOIN postcode_area_set s ON s.id = p.area_set_id WHERE p.postcode = ?",
			)
			.get("M11AA")!.old,
		3,
	);
	assert.equal(
		after
			.prepare(
				"SELECT s.ward_2025_area_id AS old, s.ward_2026_area_id AS current FROM postcodes p JOIN postcode_area_set s ON s.id = p.area_set_id WHERE p.postcode = ?",
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
		"INSERT INTO area_release VALUES (1, 'ward', '2024'), (2, 'ward', '2025'); INSERT INTO area_version VALUES (3, 1, 1, 'Old A', NULL, NULL, NULL, 1), (4, 1, 2, 'Older A', NULL, NULL, NULL, 1)",
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
		assert.deepEqual(
			JSON.parse(readSqlitePostcodeAreaShard(root, entry.path)),
			JSON.parse(files.get(entry.path)!),
		);
	const after = new DatabaseSync(path);
	assert.deepEqual(
		after
			.prepare(
				"SELECT position, distance_fallback FROM postcode_area_release ORDER BY position",
			)
			.all()
			.map((row) => ({ ...row })),
		[
			{ position: 0, distance_fallback: null },
			{ position: 1, distance_fallback: null },
			{ position: 2, distance_fallback: 1 },
		],
	);
	// Stored: only the repeated, nonzero distance is null.
	assert.deepEqual(
		{
			...after
				.prepare(
					"SELECT ward_2024_distance_cm AS a, ward_2025_distance_cm AS b, ward_2026_distance_cm AS c FROM postcodes WHERE postcode = ?",
				)
				.get("M11AA"),
		},
		{ a: 999, b: 1234, c: null },
	);
	assert.deepEqual(
		{
			...after
				.prepare(
					"SELECT ward_2026_distance_cm AS c FROM postcodes WHERE postcode = ?",
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
					"SELECT ward_2024_distance_cm AS a, ward_2025_distance_cm AS b, ward_2026_distance_cm AS c FROM postcodes_decoded WHERE postcode = ?",
				)
				.get("M11AA"),
		},
		{ a: 999, b: 1234, c: 1234 },
	);
	after.close();
});

test("assembly records reproducible provenance and detects untracked inputs", (t) => {
	const { root, path } = fixture(t);
	const base = new DatabaseSync(join(root, "data/build/atlas-base.sqlite"));
	base.exec(
		"CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT, WITHOUT ROWID; INSERT INTO meta VALUES ('schemaVersion', '3')",
	);
	base.close();
	vi.stubEnv("SOURCE_DATE_EPOCH", "1700000000");
	t.onTestFinished(() => {
		vi.unstubAllEnvs();
	});
	const assemble = () => assembleAtlas(root, { crosswalkWeights: false });
	const metadata = () => {
		const db = new DatabaseSync(path, { readOnly: true });
		try {
			return Object.fromEntries(
				db
					.prepare("SELECT key, value FROM meta")
					.all()
					.map(({ key, value }) => [String(key), String(value)]),
			);
		} finally {
			db.close();
		}
	};
	assemble();
	const noGit = metadata();
	assert.match(noGit.buildId!, /^sha256:[0-9a-f]{64}$/);
	assert.equal(noGit.buildTimestamp, "2023-11-14T22:13:20.000Z");
	assert.equal(noGit.gitCommit, undefined);
	assert.equal(noGit.dataRelease, undefined);
	const first = readFileSync(path);
	assemble();
	assert.deepEqual(metadata(), noGit);
	assert.deepEqual(readFileSync(path), first);
	const changedBase = new DatabaseSync(
		join(root, "data/build/atlas-base.sqlite"),
	);
	changedBase.exec(
		"UPDATE payloads SET payload = 'changed' WHERE id = 'existing'",
	);
	changedBase.close();
	assemble();
	assert.notEqual(metadata().buildId, noGit.buildId);

	const git = (...args: string[]) =>
		execFileSync("git", ["-C", root, ...args], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	git("init");
	writeFileSync(join(root, ".gitignore"), "data/\npipeline/\n");
	writeFileSync(join(root, "data-release.json"), '{"tag":"fixture"}\n');
	git("add", ".gitignore", "data-release.json");
	git(
		"-c",
		"user.name=Fixture",
		"-c",
		"user.email=fixture@example.test",
		"commit",
		"-m",
		"fixture",
	);
	assemble();
	const clean = metadata();
	assert.equal(clean.gitCommit, git("rev-parse", "HEAD"));
	assert.equal(clean.gitDirty, "false");
	assert.equal(clean.dataRelease, '{"tag":"fixture"}');
	assert.notEqual(clean.buildId, noGit.buildId);
	writeFileSync(join(root, "new-input.txt"), "new input");
	assemble();
	assert.equal(metadata().gitDirty, "true");
	vi.stubEnv("SOURCE_DATE_EPOCH", undefined);
	vi.stubEnv("PATH", "");
	assemble();
	const withoutGit = metadata();
	assert.equal(withoutGit.buildTimestamp, undefined);
	assert.equal(withoutGit.gitCommit, undefined);
	assert.equal(withoutGit.gitDirty, undefined);
	assert.equal(withoutGit.dataRelease, '{"tag":"fixture"}');
	vi.stubEnv("SOURCE_DATE_EPOCH", "invalid");
	assert.throws(assemble, /SOURCE_DATE_EPOCH/);
});
