import { sha256Hex } from "../lib/hash.ts";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { rebuildDatasetPayload } from "@uk-data-atlas/catalogue/node";
import { DATASET_PAYLOADS_VIEW } from "./deprecatedViews.ts";
import { publishAtlasCacheSteps, type CacheStep } from "./atlasCacheWriter.ts";

/**
 * Rebuild every dataset served from rows into the cache, gzipped. Level 9
 * writes no mtime or name, so one build always stores the same bytes.
 */
export const datasetPayloadStep = (root: string): CacheStep => ({
	component: "datasets",
	write: (cache) => {
		cache.exec(
			"DROP VIEW IF EXISTS dataset_payloads; DROP TABLE IF EXISTS dataset_payload; CREATE TABLE dataset_payload (output TEXT NOT NULL PRIMARY KEY, source_sha256 TEXT NOT NULL, sha256 TEXT NOT NULL, bytes INTEGER NOT NULL, gzip BLOB NOT NULL) STRICT, WITHOUT ROWID",
		);
		cache.exec(`CREATE VIEW dataset_payloads AS ${DATASET_PAYLOADS_VIEW}`);
		const insert = cache.prepare(
			"INSERT INTO dataset_payload VALUES (?, ?, ?, ?, ?)",
		);
		const database = new DatabaseSync(
			join(root, "data/build/atlas.sqlite"),
			{ readOnly: true },
		);
		try {
			for (const row of database
				.prepare(
					"SELECT type, output, sha256 FROM dataset_catalogue WHERE payload_id IS NULL ORDER BY output",
				)
				.all()) {
				const output = String(row.output);
				const payload = rebuildDatasetPayload(
					database,
					String(row.type),
					output,
				);
				insert.run(
					output,
					row.sha256,
					sha256Hex(payload),
					Buffer.byteLength(payload),
					gzipSync(payload, { level: 9 }),
				);
			}
		} finally {
			database.close();
		}
	},
});

export const publishDatasetPayloads = (root: string) =>
	publishAtlasCacheSteps(root, [datasetPayloadStep(root)]);
