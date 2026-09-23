import { areaMetrics } from "./areaMetrics";
import { areaNotFound } from "./areaResources";
import { geographyResolverFor, type RouteRequest } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

/**
 * Travels with a neighbour list, because the answer rests on a property of the
 * published release rather than on a distance anyone chose.
 */
const NEIGHBOUR_METHOD = {
	rule: "Two areas are neighbours where their boundaries share vertices. Adjacent areas in one release are drawn from the same vertices, so a shared border is the same coordinates on both sides and matches exactly. No distance threshold decides who is a neighbour.",
	sharedBorder:
		"Summed over the edges the two areas have in common, each counted once, with ground length from the ellipsoid's radii of curvature at the edge's mid-latitude.",
	unshared:
		"Perimeter less the border shared with the neighbours returned. For a landlocked area this is nothing; otherwise it is coastline, a national boundary, or a border with an area outside this release.",
	limits: "Within one geography and release only. Two areas that genuinely touch on the ground but were drawn from different vertices are not found, which is why this is not offered across releases.",
} as const;

/** The areas of the same release that share a border with one area, and how much of it. */
export const handleAreaNeighbourRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 6 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas" ||
		segments[5] !== "neighbours"
	)
		return undefined;
	const geographyResolver = geographyResolverFor(context);
	const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
		string,
		string,
		string,
	];
	const identity = { geography, boundaryRelease, code };
	const area = geographyResolver.area(identity);
	if (!area) return areaNotFound(context, geography, boundaryRelease, code);
	if (!geographyResolver.hasAreaGeometryCache())
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the geometry source registry before finding neighbours.",
		);
	const touches = parsedUrl.searchParams.get("touches") ?? "edge";
	if (touches !== "edge" && touches !== "any")
		return problem(
			400,
			"Invalid Query",
			"touches must be edge, for areas sharing a border, or any, which also returns areas meeting at a single point.",
		);
	try {
		const resolved = geographyResolver.areaNeighbours(identity);
		if (!resolved)
			return problem(
				404,
				"Not Found",
				"No raw geometry matches that area identity.",
			);
		const metrics = areaMetrics(resolved.geometry);
		const kept = resolved.neighbours.filter(
			(neighbour) => touches === "any" || neighbour.touch === "edge",
		);
		const sharedBorderM = kept.reduce(
			(total, neighbour) => total + neighbour.sharedBorderM,
			0,
		);
		const perimeterM = metrics?.perimeterM ?? 0;
		return {
			status: 200,
			body: envelope(releaseId, {
				id: `${geography}/${boundaryRelease}/${code}`,
				geography,
				boundaryRelease,
				...area,
				touches,
				border: {
					perimeterM,
					sharedBorderM,
					// A fully landlocked area shares every metre, and
					// summing its neighbours can land a hair over its own
					// perimeter, so the remainder is floored at nothing
					// rather than reported as a negative coastline.
					unsharedBorderM: Math.max(0, perimeterM - sharedBorderM),
					pointOnlyTouches: resolved.neighbours.filter(
						(neighbour) => neighbour.touch === "point",
					).length,
				},
				method: NEIGHBOUR_METHOD,
				neighbours: kept.flatMap((neighbour) => {
					return [
						{
							id: neighbour.id,
							...(neighbour.area ?? { code: neighbour.code }),
							touch: neighbour.touch,
							sharedBorderM: neighbour.sharedBorderM,
							shareOfPerimeter:
								perimeterM > 0
									? neighbour.sharedBorderM / perimeterM
									: 0,
							sharedEdges: neighbour.sharedEdges,
							sharedVertices: neighbour.sharedVertices,
						},
					];
				}),
			}),
		};
	} catch (error) {
		return problem(
			503,
			"Geometry Unavailable",
			error instanceof Error
				? error.message
				: "Geometry could not be loaded for neighbour lookup.",
		);
	}
};
