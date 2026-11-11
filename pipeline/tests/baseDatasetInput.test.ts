import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { expect, test } from "vitest";
import { closeAllReadOnlyDatabases } from "@uk-data-atlas/atlas-db";
import { readBaseDatasetInput } from "../src/catalog/baseDatasetInput.ts";

test("reads base-database inputs and restores queryable coverage gaps", () => {
	const root = mkdtempSync(join(tmpdir(), "base-dataset-input-"));
	const dir = join(root, "data/build");
	mkdirSync(dir, { recursive: true });
	const db = new DatabaseSync(join(dir, "atlas-base.sqlite"));
	const cache = new DatabaseSync(join(dir, "atlas-cache.sqlite"));
	try {
		db.exec(`CREATE TABLE payloads (id TEXT PRIMARY KEY, payload TEXT);
			INSERT INTO payloads VALUES ('dataset-manifest', '{"datasets":[]}'), ('dataset:whole', '{"whole":true}');
			CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT, compiled_type TEXT, compiled_sha256 TEXT, payload_id TEXT);
			INSERT INTO dataset VALUES (1, 'local-election', 'localElection', 'source', NULL), (2, 'whole', 'whole', 'hash', 'dataset:whole'), (3, 'road-collisions', 'road-collisions', 'source', NULL);
			CREATE TABLE dataset_coverage_gap (dataset_id INTEGER, edition TEXT, kind TEXT, position INTEGER, area_code TEXT, area_name TEXT, parent_name TEXT, reason TEXT, count INTEGER);
			INSERT INTO dataset_coverage_gap VALUES (1, '2022', 'election-ward', 0, 'E1', 'Ward', 'Council', 'ambiguous', NULL), (3, '2024', 'collision-area', 0, 'AIRPORT', NULL, NULL, NULL, 33), (3, '2024', 'collision-without-lsoa', 0, 'GB-SCT', NULL, NULL, NULL, 20);`);
		cache.exec(
			"CREATE TABLE dataset_payload (output TEXT, source_sha256 TEXT, sha256 TEXT, bytes INTEGER, gzip BLOB)",
		);
		const text = '{"2022":{"data":{}}}';
		cache
			.prepare("INSERT INTO dataset_payload VALUES (?, ?, ?, ?, ?)")
			.run(
				"local-election",
				"source",
				createHash("sha256").update(text).digest("hex"),
				Buffer.byteLength(text),
				gzipSync(text),
			);
		const road = '{"2024":{"data":{}}}';
		cache
			.prepare("INSERT INTO dataset_payload VALUES (?, ?, ?, ?, ?)")
			.run(
				"road-collisions",
				"source",
				createHash("sha256").update(road).digest("hex"),
				Buffer.byteLength(road),
				gzipSync(road),
			);
		expect(
			JSON.parse(readBaseDatasetInput(root, "road-collisions")),
		).toEqual({
			2024: {
				data: {},
				excluded: [{ code: "AIRPORT", collisions: 33 }],
				withoutLsoa: { "GB-SCT": 20 },
			},
		});
		expect(
			JSON.parse(readBaseDatasetInput(root, "dataset-manifest")),
		).toEqual({ datasets: [] });
		expect(JSON.parse(readBaseDatasetInput(root, "whole"))).toEqual({
			whole: true,
		});
		expect(
			JSON.parse(readBaseDatasetInput(root, "local-election")),
		).toEqual({
			2022: {
				data: {},
				excludedWards: [
					{
						wardName: "Ward",
						ladName: "Council",
						wardCode: "E1",
						reason: "ambiguous",
					},
				],
			},
		});
		cache
			.prepare(
				"UPDATE dataset_payload SET sha256 = 'bad' WHERE output = ?",
			)
			.run("local-election");
		expect(() => readBaseDatasetInput(root, "local-election")).toThrow(
			/Corrupt cached dataset/,
		);
		expect(() => readBaseDatasetInput(root, "missing")).toThrow(
			/Missing dataset/,
		);
	} finally {
		closeAllReadOnlyDatabases();
		cache.close();
		db.close();
		rmSync(root, { recursive: true, force: true });
	}
});
