import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MapArchive } from "./mapResource/archiveReader";
import { openArchive } from "./mapResource/archiveReader";
import type { MapResourceDescriptor } from "@uk-data-atlas/map-tiles/mapResources";
import type { StoredFile } from "@uk-data-atlas/artifacts";

import type { MapResources } from "@uk-data-atlas/map-tiles/mapResources";
import {
	artifactRoot,
	buildDirectory,
	repositoryRootOf,
} from "../storage/dataLayout";

/** Every whole-release download the build wrote, tiled or not. */
const allFeatures = (mapResources: MapResources) => [
	...mapResources.resources.flatMap((resource) => resource.features ?? []),
	...(mapResources.unavailable ?? []).flatMap(
		(entry) => entry.features ?? [],
	),
];

/**
 * The downloads of a release that has no map resource but was still written
 * whole, found by its geography and release.
 */
export const untiledFeatures = (
	mapResources: MapResources | undefined,
	geography: string,
	boundaryRelease: string,
) =>
	mapResources?.unavailable?.find(
		(entry) =>
			entry.geography === geography &&
			entry.boundaryRelease === boundaryRelease &&
			(entry.features?.length ?? 0) > 0,
	);

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
		if (unavailable?.features?.length)
			return {
				status: "untiled" as const,
				reason: `No tiles: ${unavailable.reason} The release is still downloadable whole as GeoParquet, at full detail as published.`,
				geoparquet: byTier(unavailable.features, "geoparquet-1.1"),
			};
		return {
			status: "unavailable" as const,
			reason:
				unavailable?.reason ??
				"No map resource has been compiled for this release.",
		};
	}
	return {
		status: "available" as const,
		mapResource: `/v1/map-resources/${resource.id}`,
		pmtiles: resource.tiles.href,
		tileJson: `/v1/map-resources/${resource.id}/tiles.json`,
		geojson: byTier(resource.features, "geojson"),
		geoparquet: byTier(resource.features, "geoparquet-1.1"),
	};
};

const byTier = (features: MapResourceDescriptor["features"], format: string) =>
	Object.fromEntries(
		features
			.filter((entry) => entry.format === format)
			.map((entry) => [entry.tier, entry.href]),
	);

/** The published map resources, when the optional map build is present. */
export const readMapResources = (
	apiRoot: string,
	assetBaseUrl?: string,
	tileBaseUrl?: string,
): MapResources => {
	const path = join(artifactRoot(apiRoot), "map-resources.json");
	if (!existsSync(path)) return { resources: [] };
	const resources: MapResources = JSON.parse(readFileSync(path, "utf8"));
	if (!assetBaseUrl) return resources;
	const href = (artifact: string) =>
		`${assetBaseUrl}/${artifact.split("/").map(encodeURIComponent).join("/")}`;
	// A download built on request has no file to put on the CDN, so it keeps
	// the API's own address.
	const featureHref = (entry: { artifact?: string; href: string }) =>
		entry.artifact ? href(entry.artifact) : entry.href;
	return {
		...resources,
		assetBaseUrl,
		tileBaseUrl,
		resources: resources.resources.map((resource) => ({
			...resource,
			tiles: { ...resource.tiles, href: href(resource.tiles.artifact) },
			features: resource.features.map((entry) => ({
				...entry,
				href: featureHref(entry),
			})),
		})),
		unavailable: resources.unavailable?.map((resource) => ({
			...resource,
			features: resource.features?.map((entry) => ({
				...entry,
				href: featureHref(entry),
			})),
		})),
	};
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
		(mapResources.assetBaseUrl ? [] : mapResources.resources).map(
			(resource) => [
				resource.id,
				openArchive(
					join(
						buildDirectory(repositoryRootOf(apiRoot)),
						resource.tiles.artifact,
					),
				),
			],
		),
	),
	mapFeatures: new Map(
		allFeatures(mapResources)
			.flatMap((entry) =>
				entry.artifact ? [{ ...entry, artifact: entry.artifact }] : [],
			)
			.map((entry) => [
				entry.artifact,
				{
					path: join(
						buildDirectory(repositoryRootOf(apiRoot)),
						entry.artifact,
					),
					bytes: entry.bytes,
					contentHash: entry.contentHash,
					...(entry.gzipBytes === undefined
						? {}
						: { gzipBytes: entry.gzipBytes }),
				},
			]),
	),
});
