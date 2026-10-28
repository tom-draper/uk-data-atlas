import { join } from "node:path";
import { AreaGeometryCache, type GeometrySourceLookup } from "./areaGeometry";
import { readGeometrySourceLookup } from "./geometrySources";
import { artifactRoot, repositoryRootOf } from "../storage/dataLayout";

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
	onStaleCompiled?: (release: string, path: string) => void,
) =>
	new AreaGeometryCache(
		repositoryRootOf(apiRoot),
		readGeometrySources(apiRoot),
		maxReleases,
		join(artifactRoot(apiRoot), "geometry-store"),
		onStaleCompiled,
	);
