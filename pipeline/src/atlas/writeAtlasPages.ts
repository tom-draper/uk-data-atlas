import { sha256 } from "@uk-data-atlas/artifacts";
import { mkdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { gzip as gzipCallback } from "node:zlib";
import { promisify } from "node:util";
import {
	ATLAS_PAGES_DIRECTORY,
	atlasAssetsDirectory,
	ATLAS_PAGES_MANIFEST,
	type AtlasPageManifest,
} from "@uk-data-atlas/atlas-db";

const gzip = promisify(gzipCallback);

/**
 * Compresses at most this many pages at once, on Node's thread pool, which
 * has four threads unless the environment resizes it.
 */
const COMPRESSING = Math.max(1, Math.min(4, availableParallelism()));

/**
 * Writes each page gzipped, then the manifest. Pages are compressed
 * concurrently but written and listed in the order given, so the output does
 * not depend on which finishes first.
 */
export async function writeAtlasPages(
	repositoryRoot: string,
	pages: Map<string, string>,
) {
	const publicDirectory = atlasAssetsDirectory(repositoryRoot);
	const directory = join(publicDirectory, ATLAS_PAGES_DIRECTORY);
	mkdirSync(directory, { recursive: true });
	const entries = [...pages];
	const compressed = new Array<Buffer>(entries.length);
	let next = 0;
	await Promise.all(
		Array.from({ length: COMPRESSING }, async () => {
			while (next < entries.length) {
				const position = next++;
				compressed[position] = await gzip(entries[position]![1], {
					level: 9,
				});
			}
		}),
	);
	const manifest: AtlasPageManifest = { schemaVersion: 1, pages: [] };
	entries.forEach(([id, json], position) => {
		const bytes = compressed[position]!;
		const artifact = `${ATLAS_PAGES_DIRECTORY}/${id}.json.gz`;
		writeFileSync(join(publicDirectory, artifact), bytes);
		manifest.pages.push({
			id,
			artifact,
			bytes: Buffer.byteLength(json),
			gzipBytes: bytes.length,
			contentHash: sha256(json),
		});
	});
	writeFileSync(
		join(publicDirectory, ATLAS_PAGES_MANIFEST),
		JSON.stringify(manifest),
	);
}
