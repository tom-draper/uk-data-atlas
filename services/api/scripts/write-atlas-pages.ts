import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import {
	ATLAS_PAGES_DIRECTORY,
	ATLAS_PAGES_MANIFEST,
	type AtlasPageManifest,
} from "../src/atlasPages";

export function writeAtlasPages(apiRoot: string, pages: Map<string, string>) {
	const directory = join(apiRoot, "public", ATLAS_PAGES_DIRECTORY);
	mkdirSync(directory, { recursive: true });
	const manifest: AtlasPageManifest = { schemaVersion: 1, pages: [] };
	for (const [id, json] of pages) {
		const gzip = gzipSync(json, { level: 9 });
		const artifact = `${ATLAS_PAGES_DIRECTORY}/${id}.json.gz`;
		writeFileSync(join(apiRoot, "public", artifact), gzip);
		manifest.pages.push({
			id,
			artifact,
			bytes: Buffer.byteLength(json),
			gzipBytes: gzip.length,
			contentHash: `sha256:${createHash("sha256").update(json).digest("hex")}`,
		});
	}
	writeFileSync(
		join(apiRoot, "public", ATLAS_PAGES_MANIFEST),
		JSON.stringify(manifest),
	);
}
