import { createHash } from "node:crypto";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { rebuildDatasetPayload } from "@uk-data-atlas/atlas-runtime/catalogue";
import { publishAtlasCache } from "./atlasCacheWriter";

const digest = (text: string) =>
	createHash("sha256").update(text).digest("hex");

/** Rebuild every dataset served from rows into the cache, checking each hash. */
export function publishDatasetPayloads(root: string) {
	return publishAtlasCache(root, "datasets", (cache) => {
		cache.exec(
			"DROP TABLE IF EXISTS dataset_payloads; CREATE TABLE dataset_payloads (output TEXT NOT NULL PRIMARY KEY, sha256 TEXT NOT NULL, payload TEXT NOT NULL) STRICT, WITHOUT ROWID",
		);
		const insert = cache.prepare(
			"INSERT INTO dataset_payloads VALUES (?, ?, ?)",
		);
		const database = new DatabaseSync(
			join(root, "data/build/atlas.sqlite"),
			{ readOnly: true },
		);
		try {
			for (const row of database
				.prepare(
					"SELECT type, output, sha256, bytes FROM datasets WHERE payloadId IS NULL ORDER BY output",
				)
				.all()) {
				const output = String(row.output);
				const payload = rebuildDatasetPayload(
					database,
					String(row.type),
					output,
				);
				if (
					digest(payload) !== row.sha256 ||
					Buffer.byteLength(payload) !== row.bytes
				)
					throw new Error(
						`Rows for ${output} do not match its manifest hash`,
					);
				insert.run(output, row.sha256, payload);
			}
		} finally {
			database.close();
		}
	});
}
