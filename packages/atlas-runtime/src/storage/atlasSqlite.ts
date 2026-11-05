import {
	readDatasetPayload,
	readDatasetPayloadWithHash,
	readStoredDatasetPayload,
} from "../catalogue/datasetPayloads.ts";
import { gunzipSync } from "node:zlib";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { atlasCachePath } from "./atlasCache.ts";
import { openReadOnlyDatabase } from "./readOnlyDatabase.ts";
import { unpackText } from "./storedPayload.ts";

/** Server-only access to the shared compiled release. Connections are shared and reopen when the file is replaced. */
export function readAtlasPayload(
	repositoryRoot: string,
	id: string,
	path = join(repositoryRoot, "data/build/atlas.sqlite"),
): string {
	const database = openReadOnlyDatabase(path);
	let stored: string | undefined;
	try {
		stored = unpackText(
			database
				.prepare("SELECT payload FROM payloads WHERE id = ?")
				.get(id)?.payload,
		);
	} finally {
		database.release();
	}
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
						"SELECT output, source_sha256, sha256 FROM dataset_payloads",
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
				.prepare("SELECT output, sha256, payloadId FROM datasets")
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

export type AtlasAssetKind = "pages" | "lookups";

/** Read precompressed website data. */
export function readAtlasAsset(root: string, kind: AtlasAssetKind, id: string) {
	const database = openReadOnlyDatabase(
		join(root, "data/build/atlas.sqlite"),
	);
	try {
		const row = database
			.prepare(
				"SELECT sha256, gzip FROM website_asset WHERE kind = ? AND id = ?",
			)
			.get(kind, id);
		if (!row) return undefined;
		if (typeof row.sha256 !== "string" || !(row.gzip instanceof Uint8Array))
			throw new Error(`Invalid atlas ${kind} asset ${id}`);
		return { sha256: row.sha256, gzip: row.gzip };
	} finally {
		database.release();
	}
}

export function readAtlasAssetText(
	root: string,
	kind: AtlasAssetKind,
	id: string,
): string {
	if (!/^[A-Za-z0-9-]+$/.test(id))
		throw new Error(`Invalid atlas asset id ${id}`);
	const asset = readAtlasAsset(root, kind, id);
	if (!asset)
		throw new Error(
			`Missing atlas ${kind} asset ${id}. Run pnpm data:build --only website-lookups.`,
		);
	return gunzipSync(asset.gzip).toString("utf8");
}
