import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MapArchive } from "./mapResource/archiveReader";
import { openArchive } from "./mapResource/archiveReader";
import type { MapResourceDescriptor } from "./mapResource/compileMapResource";
import type { StoredFile } from "./routeResponse";

export type MapResources = {
	resources: MapResourceDescriptor[];
	/** Releases the build could not compile, such as one that is not a coverage. */
	unavailable?: Array<{
		geography: string;
		boundaryRelease: string;
		reason: string;
	}>;
};

/**
 * Where to download a whole boundary release: its tiles and every tier in
 * each flat format. A release the map build could not compile says why
 * instead, and stays available area by area.
 */
export const releaseDownloads = (
	mapResources: MapResources | undefined,
	geography: string,
	boundaryRelease: string,
) => {
	const resource = mapResources?.resources.find(
		(entry) =>
			entry.geography === geography &&
			entry.boundaryRelease === boundaryRelease,
	);
	if (!resource) {
		const unavailable = mapResources?.unavailable?.find(
			(entry) =>
				entry.geography === geography &&
				entry.boundaryRelease === boundaryRelease,
		);
		return {
			status: "unavailable" as const,
			reason:
				unavailable?.reason ??
				"No map resource has been compiled for this release.",
		};
	}
	const byTier = (format: string) =>
		Object.fromEntries(
			resource.features
				.filter((entry) => entry.format === format)
				.map((entry) => [entry.tier, entry.href]),
		);
	return {
		status: "available" as const,
		mapResource: `/v1/map-resources/${resource.id}`,
		pmtiles: resource.tiles.href,
		tileJson: `/v1/map-resources/${resource.id}/tiles.json`,
		geojson: byTier("geojson"),
		geoparquet: byTier("geoparquet-1.1"),
	};
};

/** The published map resources, when the optional map build is present. */
export const readMapResources = (apiRoot: string): MapResources => {
	const path = join(apiRoot, "public", "map-resources.json");
	if (!existsSync(path)) return { resources: [] };
	return JSON.parse(readFileSync(path, "utf8")) as MapResources;
};

/**
 * Open the map archives and locate the feature downloads. Neither is read into
 * memory: a tile is read from its archive when asked for, and a download is
 * streamed from its file.
 */
export const readMapAssets = (
	apiRoot: string,
	mapResources: MapResources,
): {
	mapArchives: Map<string, MapArchive>;
	mapFeatures: Map<string, StoredFile>;
} => ({
	mapArchives: new Map(
		mapResources.resources.map((resource) => [
			resource.id,
			openArchive(join(apiRoot, "public", resource.tiles.artifact)),
		]),
	),
	mapFeatures: new Map(
		mapResources.resources.flatMap((resource) =>
			(resource.features ?? []).map((entry) => [
				entry.artifact,
				{
					path: join(apiRoot, "public", entry.artifact),
					bytes: entry.bytes,
					contentHash: entry.contentHash,
					...(entry.gzipBytes === undefined
						? {}
						: { gzipBytes: entry.gzipBytes }),
				},
			]),
		),
	),
});
