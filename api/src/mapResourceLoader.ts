import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MapArchive } from "./mapResource/archiveReader";
import { openArchive } from "./mapResource/archiveReader";
import type { MapResourceDescriptor } from "./mapResource/compileMapResource";

export type MapResources = { resources: MapResourceDescriptor[] };

/** The published map resources, when the optional map build is present. */
export const readMapResources = (apiRoot: string): MapResources => {
	const path = join(apiRoot, "public", "map-resources.json");
	if (!existsSync(path)) return { resources: [] };
	return JSON.parse(readFileSync(path, "utf8")) as MapResources;
};

/** Open map archives and load feature artifacts once for route-level reuse. */
export const readMapAssets = (
	apiRoot: string,
	mapResources: MapResources,
): {
	mapArchives: Map<string, MapArchive>;
	mapFeatures: Map<string, Buffer>;
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
				readFileSync(join(apiRoot, "public", entry.artifact)),
			]),
		),
	),
});
