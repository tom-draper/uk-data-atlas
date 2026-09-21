import { resolve } from "node:path";
import { AreaGeometryCache, type GeometrySourceLookup } from "./areaGeometry";
import { readGeometrySourceLookup } from "./geometrySources";

export const readGeometrySources = (apiRoot: string): GeometrySourceLookup =>
	readGeometrySourceLookup(apiRoot);

/**
 * Build the bounded geometry cache used by spatial routes. Keeping the source
 * lookup and cache root together makes the memory-sensitive startup boundary
 * explicit.
 */
export const createAreaGeometryCache = (
	apiRoot: string,
	maxReleases?: number,
) =>
	new AreaGeometryCache(
		resolve(apiRoot, ".."),
		readGeometrySources(apiRoot),
		maxReleases,
	);
