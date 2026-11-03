import { join } from "node:path";
import { AreaGeometryCache, type GeometrySourceLookup } from "./areaGeometry";
import { readRepositoryGeometrySourceLookup } from "./geometrySources";
import { artifactDirectory } from "../storage/dataLayout";

export const readGeometrySources = (
	repositoryRoot: string,
): GeometrySourceLookup => readRepositoryGeometrySourceLookup(repositoryRoot);

/**
 * Build the bounded geometry cache used by spatial routes. Keeping the source
 * lookup and cache root together makes the memory-sensitive startup boundary
 * explicit.
 */
export const createAreaGeometryCache = (
	repositoryRoot: string,
	maxReleases?: number,
	onStaleCompiled?: (release: string, path: string) => void,
) =>
	new AreaGeometryCache(
		repositoryRoot,
		readGeometrySources(repositoryRoot),
		maxReleases,
		join(artifactDirectory(repositoryRoot), "geometry-store"),
		onStaleCompiled,
	);
