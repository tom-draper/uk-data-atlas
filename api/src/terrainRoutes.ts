import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** Versioned terrain-product discovery. Values and tiles arrive in a later product. */
export const handleTerrainRoutes = ({
	context,
	releaseId,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (segments[0] !== "v1" || segments[1] !== "terrain") return undefined;
	const catalogue = context.terrainCatalogue;
	if (!catalogue)
		return problem(
			503,
			"Terrain Catalogue Unavailable",
			"Build the terrain catalogue before discovering terrain products.",
		);
	if (segments.length === 2)
		return { status: 200, body: envelope(releaseId, catalogue) };
	if (segments.length === 3) {
		const product = catalogue.products.find(
			(candidate) => candidate.id === segments[2],
		);
		return product
			? { status: 200, body: envelope(releaseId, product) }
			: problem(404, "Not Found", "No terrain product matches that id.");
	}
	return undefined;
};
