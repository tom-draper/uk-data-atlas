import { existsSync } from "node:fs";
import { join } from "node:path";
import { atlasCachePath } from "@uk-data-atlas/atlas-db";
import { readStoredAtlasPayload } from "@uk-data-atlas/atlas-db";
import { openReadOnlyDatabase } from "@uk-data-atlas/atlas-db";
import {
	readDatasetPayload,
	readDatasetPayloadWithHash,
	readStoredDatasetPayload,
} from "./datasetPayloads.ts";

/** Server-only access to the shared compiled release. Connections are shared and reopen when the file is replaced. */
export function readAtlasPayload(
	repositoryRoot: string,
	id: string,
	path = join(repositoryRoot, "data/build/atlas.sqlite"),
): string {
	const stored = readStoredAtlasPayload(repositoryRoot, id, path);
	if (stored !== undefined) return stored;
	// Datasets served from rows have no stored payload.
	if (id.startsWith("dataset:")) {
		const payload = readDatasetPayload(repositoryRoot, id.slice(8));
		if (payload !== undefined) return payload;
	}
	throw new Error(`Missing payload ${id} at ${path}`);
}

export function readAtlasDatasetUrls(
	repositoryRoot: string,
): Record<string, string> {
	const database = openReadOnlyDatabase(
		join(repositoryRoot, "data/build/atlas.sqlite"),
	);
	try {
		const cached = new Map<string, { source: string; hash: string }>();
		const cachePath = atlasCachePath(repositoryRoot);
		if (existsSync(cachePath)) {
			const cache = openReadOnlyDatabase(cachePath);
			try {
				for (const row of cache
					.prepare(
						"SELECT output, source_sha256, sha256 FROM dataset_payload",
					)
					.all())
					cached.set(String(row.output), {
						source: String(row.source_sha256),
						hash: String(row.sha256),
					});
			} catch {
				// Rebuild from rows if the dataset cache is absent or outdated.
			} finally {
				cache.release();
			}
		}
		return Object.fromEntries(
			database
				.prepare(
					"SELECT slug AS output, compiled_sha256 AS sha256, payload_id AS payloadId FROM dataset WHERE compiled_type IS NOT NULL",
				)
				.all()
				.map((row) => {
					const output = String(row.output);
					const found = cached.get(output);
					const hash =
						row.payloadId !== null
							? String(row.sha256)
							: found?.source === row.sha256
								? found.hash
								: readDatasetPayloadWithHash(
										repositoryRoot,
										output,
									)?.sha256;
					if (!hash) throw new Error(`Missing dataset ${output}`);
					return [output, `/data/catalogue/${hash}/${output}.json`];
				}),
		);
	} finally {
		database.release();
	}
}

export function readVersionedAtlasDataset(
	repositoryRoot: string,
	output: string,
	sha256: string,
): string | undefined {
	return readDatasetPayload(repositoryRoot, output, sha256);
}

/** A dataset's gzipped cache entry, for serving as stored. */
export const readStoredAtlasDataset = readStoredDatasetPayload;
