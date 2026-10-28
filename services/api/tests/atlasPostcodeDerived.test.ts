import { atlasCachePath } from "../src/atlasCache";
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
import { artifactRoot } from "../../../shared/dataLayout";
import { sha256 } from "../src/contentHash";
import type { PostcodeAreasShard } from "../src/postcodeAreas";
import { readAtlasPayload } from "../../../shared/atlasSqlite";
import { storePostcodeIndex } from "../../../pipeline/src/storePostcodeIndex";
import { storePostcodeAreas } from "../../../pipeline/src/storePostcodeAreas";
import { buildPostcodeCounts } from "../src/cache-build/buildPostcodeCounts";
import { validateShards } from "../../../pipeline/src/postcode-counts/validatePostcodeCountInputs";
import {
	readSqlitePostcodeAreas,
	readSqlitePostcodeAreaShard,
	readSqlitePostcodeCounts,
} from "../src/atlasPostcodeDerived";
import {
	readPostcodeCounts,
	readPostcodeAreaIndex,
	readPostcodeIndex,
} from "../src/boundaryLoader";
import {
	compilePostcodeAreas,
	PostcodeAreaIndex,
	NONE,
	SEVERAL,
} from "../src/postcodeAreas";
import { postcodeIndexFor, postcodeRow } from "./postcodeFixtures";

function fixture(t: TestContext) {
	const root = mkdtempSync(join(tmpdir(), "atlas-postcode-derived-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const apiRoot = join(root, "services/api");
	mkdirSync(join(root, "data/build"), { recursive: true });
	mkdirSync(join(artifactRoot(apiRoot), "postcode-areas"), {
		recursive: true,
	});
	const path = join(root, "data/build/atlas.sqlite");
	const db = new DatabaseSync(path);
	db.exec(
		`CREATE TABLE payloads (id TEXT PRIMARY KEY, payload TEXT NOT NULL) WITHOUT ROWID;
		INSERT INTO payloads VALUES ('existing', 'retained');
		CREATE TABLE area_releases (position INTEGER PRIMARY KEY, geography TEXT, id TEXT);
		INSERT INTO area_releases VALUES (0, 'ward', '2026');
		CREATE TABLE areas (id INTEGER PRIMARY KEY, releasePosition INTEGER REFERENCES area_releases(position), code TEXT, inInventory INTEGER, name TEXT, aliases TEXT, UNIQUE(releasePosition, code));
		INSERT INTO areas VALUES (1, 0, 'A', 1, 'Area A', NULL);`,
	);
	db.close();
	const postcodes = postcodeIndexFor([
		postcodeRow("M1 1AA", { usrtypind: "1" }),
		postcodeRow("M1 1AB", { doterm: "200102" }),
		postcodeRow("SW1A 1AA", { east1m: "", north1m: "", gridind: "9" }),
	]);
	storePostcodeIndex(root, postcodes.artifact, (path) =>
		postcodes.texts.get(path)!,
	);
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

test("SQLite mappings retain exact bytes, boundary matches, distances and empty placements without JSON", (t) => {
	const { root, apiRoot, path, compiled, texts } = fixture(t);
	writeFileSync(
		join(artifactRoot(apiRoot), "postcode-areas.json"),
		"obsolete",
	);
	writeFileSync(
		join(artifactRoot(apiRoot), "postcode-areas/obsolete.json.gz"),
		"obsolete",
	);
	for (let run = 0; run < 2; run++)
		storePostcodeAreas(root, compiled.artifact, (path) => texts.get(path)!);
	assert.equal(readAtlasPayload(root, "existing"), "retained");
	assert.equal(
		existsSync(join(artifactRoot(apiRoot), "postcode-areas.json")),
		false,
	);
	assert.equal(
		existsSync(join(artifactRoot(apiRoot), "postcode-areas")),
		false,
	);
	assert.deepEqual(readSqlitePostcodeAreas(apiRoot), compiled.artifact);
	const db = new DatabaseSync(path);
	assert.deepEqual(
		{
			...db
				.prepare(
					"SELECT p.postcode, a.code, a.name FROM postcodes p JOIN areas a ON a.id = p.wardAreaId",
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
		assert.equal(
			readSqlitePostcodeAreaShard(apiRoot, file.path),
			file.text,
		);
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
	const postcodes = readPostcodeIndex(apiRoot);
	const index = readPostcodeAreaIndex(
		apiRoot,
		postcodes,
		inventory,
		geometry,
	);
	assert.throws(
		() =>
			readPostcodeAreaIndex(
				apiRoot,
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
		() => readPostcodeAreaIndex(apiRoot, postcodes, inventory, new Map()),
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

test("counts build entirely from SQLite, preserve zero and uncovered results, and reject corruption and stale inputs", (t) => {
	const { root, apiRoot, path, compiled, texts } = fixture(t);
	storePostcodeAreas(root, compiled.artifact, (path) => texts.get(path)!);
	assert.deepEqual(validateShards(root).areas, compiled.artifact);
	writeFileSync(
		join(artifactRoot(apiRoot), "postcode-counts.json"),
		"obsolete",
	);
	const built = buildPostcodeCounts(root);
	assert.equal(built.countedAreas, 2);
	assert.deepEqual(readSqlitePostcodeCounts(apiRoot), built.artifact);
	assert.equal(
		existsSync(join(artifactRoot(apiRoot), "postcode-counts.json")),
		false,
	);
	const postcodes = readPostcodeIndex(apiRoot);
	const areas = new PostcodeAreaIndex(compiled.artifact, postcodes, (path) =>
		readSqlitePostcodeAreaShard(apiRoot, path),
	);
	const counts = readPostcodeCounts(apiRoot, postcodes, areas);
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
		() => readPostcodeCounts(apiRoot, postcodes, stale),
		/current postcode area index/,
	);
	const db = new DatabaseSync(atlasCachePath(root));
	db.exec("UPDATE postcode_counts SET live = 99");
	db.close();
	assert.throws(
		() => readPostcodeCounts(apiRoot, postcodes, areas),
		/content hash/,
	);
});

test("failed mapping replacements preserve the published database and old files; missing SQLite has no JSON fallback", (t) => {
	const { root, apiRoot, path, compiled, texts } = fixture(t);
	storePostcodeAreas(root, compiled.artifact, (path) => texts.get(path)!);
	const before = readFileSync(path);
	writeFileSync(
		join(artifactRoot(apiRoot), "postcode-areas.json"),
		JSON.stringify(compiled.artifact),
	);
	assert.throws(
		() => storePostcodeAreas(root, compiled.artifact, () => "corrupt"),
		/Invalid postcode area shard/,
	);
	assert.deepEqual(readFileSync(path), before);
	assert.equal(
		existsSync(join(artifactRoot(apiRoot), "postcode-areas.json")),
		true,
	);
	rmSync(path);
	assert.throws(() => readSqlitePostcodeAreas(apiRoot));
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
				apiRoot,
				compiled.artifact.shards[0]!.path,
			),
		/Invalid SQLite postcode area shard/,
	);
});

test("repeated geographies use exact releases and preserve shard release order", (t) => {
	const { root, apiRoot, path, compiled } = fixture(t);
	const db = new DatabaseSync(path);
	db.exec(
		"INSERT INTO area_releases VALUES (1, 'ward', '2025'); INSERT INTO areas VALUES (3, 1, 'A', 1, 'Old area A', NULL)",
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
			readSqlitePostcodeAreaShard(apiRoot, entry.path),
			files.get(entry.path),
		);
	const after = new DatabaseSync(path);
	assert.equal(
		after
			.prepare(
				'SELECT "ward_2025AreaId" AS old, "ward_2026AreaId" AS current FROM postcodes WHERE postcode = ?',
			)
			.get("M11AA")!.old,
		3,
	);
	assert.equal(
		after
			.prepare(
				'SELECT "ward_2025AreaId" AS old, "ward_2026AreaId" AS current FROM postcodes WHERE postcode = ?',
			)
			.get("M11AA")!.current,
		1,
	);
	assert.deepEqual(after.prepare("PRAGMA foreign_key_check").all(), []);
	after.close();
});
