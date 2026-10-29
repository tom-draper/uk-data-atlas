import assert from "node:assert/strict";
import { statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { inflateSync } from "node:zlib";
import {
	readSqlitePostcodeAreaShard,
	readSqlitePostcodeAreas,
} from "@uk-data-atlas/atlas-runtime/storage";
import { readSqlitePostcodeShard } from "@uk-data-atlas/atlas-runtime/storage";
import { sha256 } from "@uk-data-atlas/artifacts";
import type {
	PostcodeIndexArtifact,
	PostcodeShard,
} from "@uk-data-atlas/geography/postcode-index-types";

const [beforePath, apiRoot, output] = process.argv.slice(2);
assert.ok(
	beforePath && apiRoot,
	"Usage: compare-postcode-sqlite.ts BEFORE API_ROOT [OUTPUT]",
);
const afterPath = resolve(apiRoot, "../../data/build/atlas.sqlite");
const before = new DatabaseSync(beforePath, { readOnly: true });
const after = new DatabaseSync(afterPath, { readOnly: true });
try {
	const index: PostcodeIndexArtifact = JSON.parse(
		String(
			before
				.prepare(
					"SELECT payload FROM payloads WHERE id = 'postcode-index'",
				)
				.get()!.payload,
		),
	);
	const artifact = readSqlitePostcodeAreas(apiRoot);
	assert.ok(
		index.shards.length > 0 && artifact.shards.length > 0,
		"No shards compared",
	);
	assert.equal(
		after
			.prepare("SELECT payload FROM payloads WHERE id = 'postcode-index'")
			.get()!.payload,
		before
			.prepare("SELECT payload FROM payloads WHERE id = 'postcode-index'")
			.get()!.payload,
	);
	assert.equal(
		after
			.prepare("SELECT payload FROM payloads WHERE id = 'postcode-areas'")
			.get()!.payload,
		before
			.prepare("SELECT payload FROM payloads WHERE id = 'postcode-areas'")
			.get()!.payload,
	);
	const oldArea = (path: string) => {
		const db = new DatabaseSync(beforePath, { readOnly: true });
		try {
			return inflateSync(
				db
					.prepare(
						"SELECT payload FROM postcode_area_shards WHERE path = ?",
					)
					.get(path)!.payload as Uint8Array,
			).toString("utf8");
		} finally {
			db.close();
		}
	};
	let areaMismatches = 0;
	for (const entry of artifact.shards) {
		const old = oldArea(entry.path);
		assert.equal(sha256(old), entry.contentHash);
		if (old !== readSqlitePostcodeAreaShard(apiRoot, entry.path))
			areaMismatches++;
	}
	let postcodeMismatches = 0;
	for (const entry of index.shards) {
		const rows = before
			.prepare(
				"SELECT * FROM postcodes WHERE district = ? ORDER BY position",
			)
			.all(entry.district);
		const shard: PostcodeShard = {
			schemaVersion: 1,
			district: entry.district,
			postcodes: rows.map((r) => String(r.postcode)),
			grid: rows.flatMap((r) => [
				r.easting === null ? null : Number(r.easting),
				r.northing === null ? null : Number(r.northing),
			]),
			quality: rows.map((r) => r.quality).join(""),
			country: rows.map((r) => r.country).join(""),
			introduced: rows.map((r) => Number(r.introduced)),
			terminated: rows.map((r) => Number(r.terminated)),
			largeUser: rows.map((r) => r.largeUser).join(""),
		};
		const old = `${JSON.stringify(shard)}\n`;
		assert.equal(sha256(old), entry.contentHash);
		if (old !== readSqlitePostcodeShard(apiRoot, entry))
			postcodeMismatches++;
	}
	const largest = index.shards.reduce((a, b) =>
		a.postcodes > b.postcodes ? a : b,
	);
	const area = artifact.shards.find((e) => e.district === largest.district)!;
	const timing = (read: () => unknown) => {
		read();
		const samplesMs = Array.from({ length: 9 }, () => {
			const start = performance.now();
			assert.ok(read());
			return performance.now() - start;
		}).sort((a, b) => a - b);
		return { medianMs: samplesMs[4], samplesMs };
	};
	const size = (db: DatabaseSync, path: string) => ({
		fileBytes: statSync(path).size,
		objects: db
			.prepare(
				"SELECT name, sum(pgsize) AS bytes FROM dbstat GROUP BY name ORDER BY name",
			)
			.all(),
	});
	const lookup = (path: string) => {
		const db = new DatabaseSync(path, { readOnly: true });
		try {
			return db
				.prepare("SELECT * FROM postcodes WHERE postcode = ?")
				.get("SW1A1AA");
		} finally {
			db.close();
		}
	};
	assert.deepEqual(after.prepare("PRAGMA foreign_key_check").all(), []);
	const result = {
		postcodeShardsCompared: index.shards.length,
		areaShardsCompared: artifact.shards.length,
		postcodeMismatches,
		areaMismatches,
		benchmark: {
			district: largest.district,
			postcodes: largest.postcodes,
			areaShard: {
				before: timing(() => oldArea(area.path)),
				after: timing(() =>
					readSqlitePostcodeAreaShard(apiRoot, area.path),
				),
			},
			postcodeLookup: {
				before: timing(() => lookup(beforePath)),
				after: timing(() => lookup(afterPath)),
			},
		},
		before: size(before, beforePath),
		after: size(after, afterPath),
	};
	assert.equal(areaMismatches, 0);
	assert.equal(postcodeMismatches, 0);
	const text = JSON.stringify(result, null, 2) + "\n";
	if (output) writeFileSync(output, text);
	console.log(text);
} finally {
	before.close();
	after.close();
}
