import { sha256Hex } from "../lib/hash.ts";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import {
	compiledDatasetTypes,
	rebuildDatasetPayload,
} from "@uk-data-atlas/catalogue/node";
import { buildMetadataPathOf } from "@uk-data-atlas/atlas-db";
import { writeCachePart, type CacheStep } from "./atlasCacheWriter.ts";

/**
 * Rebuild every dataset served from rows into the cache, gzipped, from the
 * database at `canonical`. Level 9 writes no mtime or name, so one build
 * always stores the same bytes.
 */
const datasetPayloadStep = (canonical: string): CacheStep => ({
	component: "datasets",
	write: (cache) => {
		cache.exec(
			"DROP TABLE IF EXISTS dataset_payload; CREATE TABLE dataset_payload (output TEXT NOT NULL PRIMARY KEY, source_sha256 TEXT NOT NULL, sha256 TEXT NOT NULL, bytes INTEGER NOT NULL, gzip BLOB NOT NULL) STRICT, WITHOUT ROWID",
		);
		const insert = cache.prepare(
			"INSERT INTO dataset_payload VALUES (?, ?, ?, ?, ?)",
		);
		const database = new DatabaseSync(canonical, { readOnly: true });
		const build = new DatabaseSync(buildMetadataPathOf(canonical), {
			readOnly: true,
		});
		try {
			const typeOf = compiledDatasetTypes(build);
			for (const row of build
				.prepare(
					"SELECT compiled_type AS type, slug AS output, compiled_sha256 AS sha256 FROM dataset_build WHERE compiled_type IS NOT NULL AND payload_id IS NULL ORDER BY slug",
				)
				.all()) {
				const output = String(row.output);
				const payload = rebuildDatasetPayload(
					database,
					String(row.type),
					output,
					typeOf,
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
			build.close();
			database.close();
		}
	},
});

/** Write the datasets part from the selected atlas and its build metadata. */
export const writeDatasetPayloads = (
	root: string,
	canonical = join(root, "data/build/atlas.sqlite"),
) => writeCachePart(root, datasetPayloadStep(canonical), { canonical });
