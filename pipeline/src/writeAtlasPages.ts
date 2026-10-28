import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import {
	ATLAS_PAGES_DIRECTORY,
	atlasAssetsDirectory,
	ATLAS_PAGES_MANIFEST,
	type AtlasPageManifest,
} from "@uk-data-atlas/atlas-runtime/storage";

export function writeAtlasPages(
	repositoryRoot: string,
	pages: Map<string, string>,
) {
	const publicDirectory = atlasAssetsDirectory(repositoryRoot);
	const directory = join(publicDirectory, ATLAS_PAGES_DIRECTORY);
	mkdirSync(directory, { recursive: true });
	const manifest: AtlasPageManifest = { schemaVersion: 1, pages: [] };
	for (const [id, json] of pages) {
		const gzip = gzipSync(json, { level: 9 });
		const artifact = `${ATLAS_PAGES_DIRECTORY}/${id}.json.gz`;
		writeFileSync(join(publicDirectory, artifact), gzip);
		manifest.pages.push({
			id,
			artifact,
			bytes: Buffer.byteLength(json),
			gzipBytes: gzip.length,
			contentHash: `sha256:${createHash("sha256").update(json).digest("hex")}`,
		});
	}
	writeFileSync(
		join(publicDirectory, ATLAS_PAGES_MANIFEST),
		JSON.stringify(manifest),
	);
}
