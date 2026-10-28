import {
	ATLAS_PAGES_DIRECTORY,
	atlasAssetsDirectory,
	ATLAS_PAGES_MANIFEST,
	type AtlasPageManifest,
} from "./atlasAssets";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
	envelope,
	problem,
	type ApiResponse,
	type StoredFile,
} from "../api/routeResponse";
import type { RouteRequest } from "../areas/routing";
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

export const handleAtlasPageRoutes = ({
	context,
	releaseId,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 3 ||
		segments[0] !== "v1" ||
		segments[1] !== "atlas-pages" ||
		!segments[2]?.endsWith(".json")
	)
		return undefined;
	const id = segments[2].slice(0, -".json".length);
	const page = context.atlasPages?.get(id);
	if (page)
		return {
			status: 200,
			body: envelope(releaseId, {
				id,
				href: `/v1/atlas-pages/${id}.json`,
				contentHash: page.contentHash,
			}),
			representation: { contentType: "application/json", body: page },
		};
	return context.atlasPages?.size
		? problem(404, "Not Found", "No atlas page matches that id.")
		: problem(
				503,
				"Catalogue Unavailable",
				"Build the atlas pages before downloading them.",
			);
};
