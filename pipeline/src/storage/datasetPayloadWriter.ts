import { createHash } from "node:crypto";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { rebuildDatasetPayload } from "@uk-data-atlas/atlas-runtime/catalogue";
import { publishAtlasCache } from "./atlasCacheWriter.ts";

const digest = (text: string) =>
	createHash("sha256").update(text).digest("hex");

/**
 * Rebuild every dataset served from rows into the cache, gzipped. Level 9
 * writes no mtime or name, so one build always stores the same bytes.
 */
export function publishDatasetPayloads(root: string) {
	return publishAtlasCache(root, "datasets", (cache) => {
		cache.exec(
			"DROP TABLE IF EXISTS dataset_payloads; CREATE TABLE dataset_payloads (output TEXT NOT NULL PRIMARY KEY, source_sha256 TEXT NOT NULL, sha256 TEXT NOT NULL, bytes INTEGER NOT NULL, gzip BLOB NOT NULL) STRICT, WITHOUT ROWID",
		);
		const insert = cache.prepare(
			"INSERT INTO dataset_payloads VALUES (?, ?, ?, ?, ?)",
		);
		const database = new DatabaseSync(
			join(root, "data/build/atlas.sqlite"),
			{ readOnly: true },
		);
		try {
			for (const row of database
				.prepare(
					"SELECT type, output, sha256 FROM datasets WHERE payloadId IS NULL ORDER BY output",
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
					digest(payload),
					Buffer.byteLength(payload),
					gzipSync(payload, { level: 9 }),
				);
			}
		} finally {
			database.close();
		}
	});
}
