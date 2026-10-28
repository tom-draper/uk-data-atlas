import {
	ATLAS_PAGES_DIRECTORY,
	atlasAssetsDirectory,
	ATLAS_PAGES_MANIFEST,
	type AtlasPageManifest,
} from "./atlasAssets";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { StoredFile } from "../api/routeResponse";
import { repositoryRootOf } from "./dataLayout";

/** The built pages by id, or none where they have not been built. */
export const readAtlasPages = (apiRoot: string): Map<string, StoredFile> => {
	const directory = atlasAssetsDirectory(repositoryRootOf(apiRoot));
	const manifestPath = resolve(directory, ATLAS_PAGES_MANIFEST);
	if (!existsSync(manifestPath)) return new Map();
	const manifest: AtlasPageManifest = JSON.parse(
		readFileSync(manifestPath, "utf8"),
	);
	if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.pages))
		throw new Error(`${ATLAS_PAGES_MANIFEST} is not schema version 1.`);
	return new Map(
		manifest.pages.map((entry) => {
			if (
				!/^[A-Za-z0-9-]+$/.test(entry.id) ||
				entry.artifact !==
					`${ATLAS_PAGES_DIRECTORY}/${entry.id}.json.gz`
			)
				throw new Error(`Invalid atlas page path ${entry.artifact}`);
			const path = resolve(directory, entry.artifact);
			if (statSync(path).size !== entry.gzipBytes)
				throw new Error(`Atlas page size mismatch at ${path}`);
			return [
				entry.id,
				{
					path,
					bytes: entry.bytes,
					gzipBytes: entry.gzipBytes,
					contentHash: entry.contentHash,
				},
			];
		}),
	);
};
