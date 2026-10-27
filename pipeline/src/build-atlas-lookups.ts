import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { ATLAS_BOUNDARY_VINTAGES } from "@uk-data-atlas/catalogue";
import { compileAtlasLookups } from "@uk-data-atlas/geography";
import { readLookupResolver } from "./lookupResolver";
import {
	ATLAS_LOOKUPS_DIRECTORY,
	atlasAssetsDirectory,
	ATLAS_LOOKUPS_MANIFEST,
	type AtlasLookupManifest,
} from "../../shared/atlasAssets";
import { apiRootOf, repositoryRootOf } from "../../shared/dataLayout";

const apiRoot = apiRootOf(resolve(import.meta.dirname, "../.."));
const publicDirectory = atlasAssetsDirectory(repositoryRootOf(apiRoot));
const directory = join(publicDirectory, ATLAS_LOOKUPS_DIRECTORY);

rmSync(join(publicDirectory, ATLAS_LOOKUPS_MANIFEST), { force: true });
rmSync(directory, { recursive: true, force: true });
const lookups = compileAtlasLookups(
	readLookupResolver(apiRoot),
	ATLAS_BOUNDARY_VINTAGES,
);

mkdirSync(directory, { recursive: true });
const manifest: AtlasLookupManifest = { schemaVersion: 1, lookups: [] };
for (const [name, json] of [...lookups].sort(([a], [b]) =>
	a.localeCompare(b),
)) {
	const id = name.slice(0, -".json".length);
	// Stored gzipped: the server sends it as is to a client that accepts it.
	const gzipped = gzipSync(json, { level: 9 });
	writeFileSync(join(directory, `${id}.json.gz`), gzipped);
	manifest.lookups.push({
		id,
		artifact: `${ATLAS_LOOKUPS_DIRECTORY}/${id}.json.gz`,
		bytes: Buffer.byteLength(json),
		gzipBytes: gzipped.length,
		contentHash: `sha256:${createHash("sha256").update(json).digest("hex")}`,
	});
	console.log(`Wrote ${ATLAS_LOOKUPS_DIRECTORY}/${id}.json.gz`);
}
writeFileSync(
	join(publicDirectory, ATLAS_LOOKUPS_MANIFEST),
	`${JSON.stringify(manifest, null, "\t")}\n`,
);
