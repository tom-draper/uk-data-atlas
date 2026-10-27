import {
	ATLAS_LOOKUPS_DIRECTORY,
	atlasAssetsDirectory,
	ATLAS_LOOKUPS_MANIFEST,
	type AtlasLookupManifest,
} from "./atlasAssets";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
	envelope,
	problem,
	type ApiResponse,
	type StoredFile,
} from "./routeResponse";
import type { RouteRequest } from "./routing";
import { repositoryRootOf } from "./dataLayout";

/** The built lookups by id, or none where they have not been built. */
export const readAtlasLookups = (apiRoot: string): Map<string, StoredFile> => {
	const directory = atlasAssetsDirectory(repositoryRootOf(apiRoot));
	const manifestPath = resolve(directory, ATLAS_LOOKUPS_MANIFEST);
	if (!existsSync(manifestPath)) return new Map();
	const manifest: AtlasLookupManifest = JSON.parse(
		readFileSync(manifestPath, "utf8"),
	);
	if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.lookups))
		throw new Error(`${ATLAS_LOOKUPS_MANIFEST} is not schema version 1.`);
	return new Map(
		manifest.lookups.map((entry) => {
			if (
				!/^[a-z0-9-]+$/.test(entry.id) ||
				entry.artifact !==
					`${ATLAS_LOOKUPS_DIRECTORY}/${entry.id}.json.gz`
			)
				throw new Error(`Invalid atlas lookup path ${entry.artifact}`);
			const path = resolve(directory, entry.artifact);
			if (statSync(path).size !== entry.gzipBytes)
				throw new Error(`Atlas lookup size mismatch at ${path}`);
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

export const handleAtlasLookupRoutes = ({
	context,
	releaseId,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 3 ||
		segments[0] !== "v1" ||
		segments[1] !== "atlas-lookups" ||
		!segments[2]?.endsWith(".json")
	)
		return undefined;
	const id = segments[2].slice(0, -".json".length);
	const lookup = context.atlasLookups?.get(id);
	if (lookup)
		return {
			status: 200,
			body: envelope(releaseId, {
				id,
				href: `/v1/atlas-lookups/${id}.json`,
				contentHash: lookup.contentHash,
			}),
			representation: { contentType: "application/json", body: lookup },
		};
	return context.atlasLookups?.size
		? problem(404, "Not Found", "No atlas lookup matches that id.")
		: problem(
				503,
				"Catalogue Unavailable",
				"Build the atlas lookups before downloading them.",
			);
};
