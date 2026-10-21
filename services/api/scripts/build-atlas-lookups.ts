/**
 * Compile the atlas's containment and lineage lookups from the geography
 * resolver, for the boundary releases the atlas draws, and list them in
 * public/atlas-lookups.json. The API serves them at
 * /v1/atlas-lookups/{lookup-id}.json; the atlas fetches them there.
 */
import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { ATLAS_BOUNDARY_VINTAGES } from "@uk-data-atlas/catalogue";
import { compileAtlasLookups } from "@uk-data-atlas/geography";
import { readApiCatalogues } from "../src/catalogueLoader";
import {
	ATLAS_LOOKUPS_DIRECTORY,
	ATLAS_LOOKUPS_MANIFEST,
	type AtlasLookupManifest,
} from "../src/atlasLookups";

const apiRoot = resolve(import.meta.dirname, "..");
const publicDirectory = join(apiRoot, "public");
const directory = join(publicDirectory, ATLAS_LOOKUPS_DIRECTORY);

// Clear the last build first, so loading the catalogues does not read it.
rmSync(join(publicDirectory, ATLAS_LOOKUPS_MANIFEST), { force: true });
rmSync(directory, { recursive: true, force: true });
const { geographyResolver } = readApiCatalogues(apiRoot, {
	loadEvidenceDocuments: false,
});
const lookups = compileAtlasLookups(geographyResolver, ATLAS_BOUNDARY_VINTAGES);

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
