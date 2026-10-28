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
import { gzipSync } from "node:zlib";
import { readAtlasPayload } from "../../../shared/atlasSqlite";
import { storePostcodeIndex } from "../scripts/store-postcode-index";
import { buildPostcodeIndex } from "../../../pipeline/src/build-postcode-index";
import { readPostcodeIndex } from "../src/boundaryLoader";
import { readSqlitePostcodeShard } from "../src/atlasPostcodes";
import { createGeographyResolver } from "../src/geographyResolver";
import { route } from "../src/routes";
import { parsePostcode } from "@uk-data-atlas/geography";
import type { PostcodeSourceRow } from "../../../pipeline/src/postcodeIndex";
import {
	postcodeIndexFor,
	postcodeRow,
	postcodeSource,
} from "./postcodeFixtures";
import { testContext } from "./routeFixtures";

const rows = [
	postcodeRow("M1 1AE"),
	postcodeRow("M10 1AA"),
	postcodeRow("M1A 1AA"),
	postcodeRow("M1 1AA", { doterm: "200102", usrtypind: "1" }),
	postcodeRow("SW1A 1AA", { east1m: "", north1m: "", gridind: "9" }),
	postcodeRow("CF1 1AA", { ctry: "W92000004", gridind: "8" }),
	postcodeRow("BT1 1AA", { ctry: "N92000002" }),
];
function fixture(t: TestContext) {
	const root = mkdtempSync(join(tmpdir(), "atlas-postcodes-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const apiRoot = join(root, "services/api");
	mkdirSync(join(root, "data/build"), { recursive: true });
	mkdirSync(join(artifactRoot(apiRoot), "postcodes/obsolete"), {
		recursive: true,
	});
	const path = join(root, "data/build/atlas.sqlite");
	const database = new DatabaseSync(path);
	database.exec(
		"CREATE TABLE payloads (id TEXT PRIMARY KEY, payload TEXT NOT NULL) WITHOUT ROWID; INSERT INTO payloads VALUES ('dataset:existing', 'retained');",
	);
	database.close();
	writeFileSync(
		join(artifactRoot(apiRoot), "postcode-index.json"),
		"obsolete",
	);
	writeFileSync(
		join(artifactRoot(apiRoot), "postcodes/obsolete/old.json.gz"),
		"obsolete",
	);
	return { root, apiRoot, path };
}

test("SQLite retains every postcode field, exact shard bytes, positions and route responses without JSON", (t) => {
	const { root, apiRoot } = fixture(t);
	const before = postcodeIndexFor(rows);
	storePostcodeIndex(root, before.artifact, (path) =>
		before.texts.get(path)!,
	);
	storePostcodeIndex(root, before.artifact, (path) =>
		before.texts.get(path)!,
	);
	assert.equal(readAtlasPayload(root, "dataset:existing"), "retained");
	assert.equal(existsSync(join(artifactRoot(apiRoot), "postcodes")), false);
	assert.equal(
		existsSync(join(artifactRoot(apiRoot), "postcode-index.json")),
		false,
	);
	const after = readPostcodeIndex(apiRoot);
	assert.deepEqual(after.artifact, before.artifact);
	for (const shard of before.artifact.shards)
		assert.equal(
			readSqlitePostcodeShard(apiRoot, shard),
			before.texts.get(shard.path),
		);
	for (const query of [
		"m11ae",
		"M1 1AA",
		"SW1A 1AA",
		"CF1 1AA",
		"BT1 1AA",
		"ZZ1 1AA",
	]) {
		const parsed = parsePostcode(query);
		assert.ok(parsed && parsed.kind === "unit");
		assert.deepEqual(after.lookup(parsed), before.index.lookup(parsed));
		assert.deepEqual(
			after.position(parsed.compact),
			before.index.position(parsed.compact),
		);
		const context = (index: typeof after) => ({
			...testContext(),
			resolver: createGeographyResolver({ postcodeIndex: index }),
		});
		for (const view of ["", "?view=compact"])
			assert.deepEqual(
				route(
					"GET",
					`/v1/postcodes/${parsed.compact}${view}`,
					context(after),
				),
				route(
					"GET",
					`/v1/postcodes/${parsed.compact}${view}`,
					context(before.index),
				),
			);
	}
	assert.deepEqual(after.position("M11AA"), { district: "M1", at: 0 });
	const parsed = parsePostcode("SW1A 1AA");
	assert.ok(parsed && parsed.kind === "unit");
	const result = after.lookup(parsed);
	assert.ok(result.status === "found");
	assert.equal(result.record.centroid, null);
	assert.equal(result.record.status, "live");
});

test("replacement removes old rows and corrupt shards preserve published data and legacy files", (t) => {
	const { root, apiRoot, path } = fixture(t);
	const original = postcodeIndexFor(rows);
	storePostcodeIndex(root, original.artifact, (path) =>
		original.texts.get(path)!,
	);
	const replacement = postcodeIndexFor([postcodeRow("B1 1AA")]);
	storePostcodeIndex(root, replacement.artifact, (path) =>
		replacement.texts.get(path)!,
	);
	assert.equal(readPostcodeIndex(apiRoot).position("M11AE"), undefined);
	assert.deepEqual(readPostcodeIndex(apiRoot).position("B11AA"), {
		district: "B1",
		at: 0,
	});
	const before = readFileSync(path);
	writeFileSync(
		join(artifactRoot(apiRoot), "postcode-index.json"),
		"retained on failure",
	);
	assert.throws(
		() => storePostcodeIndex(root, original.artifact, () => "corrupt"),
		/Invalid postcode shard/,
	);
	assert.deepEqual(readFileSync(path), before);
	assert.equal(
		readFileSync(
			join(artifactRoot(apiRoot), "postcode-index.json"),
			"utf8",
		),
		"retained on failure",
	);
	assert.equal(existsSync(`${path}.postcodes.tmp`), false);
});

test("corrupt stored records are refused and missing SQLite never falls back to JSON", (t) => {
	const { root, apiRoot, path } = fixture(t);
	const before = postcodeIndexFor(rows);
	storePostcodeIndex(root, before.artifact, (path) =>
		before.texts.get(path)!,
	);
	const database = new DatabaseSync(path);
	database.exec("UPDATE postcodes SET introduced = 199901");
	database.close();
	assert.throws(
		() => readSqlitePostcodeShard(apiRoot, before.artifact.shards[0]!),
		/Invalid SQLite postcode district/,
	);
	writeFileSync(
		join(artifactRoot(apiRoot), "postcode-index.json"),
		JSON.stringify(before.artifact),
	);
	rmSync(path);
	assert.throws(() => readPostcodeIndex(apiRoot));
});

test("the source builder reads filtered gzip rows and writes only to the shared database", async (t) => {
	const { root, apiRoot } = fixture(t);
	const directory = join(root, "data/source/postcodes/onspd/2026-08");
	mkdirSync(directory, { recursive: true });
	const sourceRows = rows.filter((row) => !row.ctry.startsWith("N"));
	const columns: Array<keyof PostcodeSourceRow> = [
		"pcds",
		"dointr",
		"doterm",
		"usrtypind",
		"east1m",
		"north1m",
		"gridind",
		"ctry",
	];
	const csv =
		[
			columns
				.map((column) => (column === "ctry" ? "ctry26cd" : column))
				.join(","),
			...sourceRows.map((row) =>
				columns.map((column) => row[column]).join(","),
			),
		].join("\n") + "\n";
	writeFileSync(join(directory, "onspd.csv.gz"), gzipSync(csv));
	writeFileSync(
		join(directory, "meta.json"),
		JSON.stringify({
			...postcodeSource,
			temporalCoverage: postcodeSource.edition,
			files: [{ role: "source", path: "onspd.csv.gz", sha256: "onspd" }],
		}),
	);
	const result = await buildPostcodeIndex(root);
	assert.equal(result.artifact.counts.postcodes, 6);
	assert.equal(
		readPostcodeIndex(apiRoot).artifact.contentHash,
		result.artifact.contentHash,
	);
	assert.equal(existsSync(join(artifactRoot(apiRoot), "postcodes")), false);
});
