import {
	GENERALISATION_METHOD,
	GEOMETRY_TIERS,
	isGeometryTier,
	simplifyGeometry,
} from "./simplifyGeometry";
import { areaNotFound, findArea } from "./areaResources";
import type { RouteRequest } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

/** One area's published boundary as a GeoJSON feature, generalised to a tier on request. */
export const handleAreaGeometryRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 6 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas" ||
		segments[5] !== "geometry"
	)
		return undefined;
	const { areaLookup, areaGeometryCache } = context;
	const [geography, boundaryRelease, code] = segments.slice(2, 5);
	const area = findArea(
		areaLookup,
		geography as string,
		boundaryRelease as string,
		code as string,
	);
	if (!area) return areaNotFound(context, geography, boundaryRelease, code);
	if (!areaGeometryCache)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the geometry source registry before retrieving geometry.",
		);
	try {
		const geometry = areaGeometryCache.get(
			geography as string,
			boundaryRelease as string,
			code as string,
		);
		if (!geometry)
			return problem(
				404,
				"Not Found",
				"No raw geometry matches that area identity.",
			);
		const requestedTier = parsedUrl.searchParams.get("tier") ?? "full";
		if (!isGeometryTier(requestedTier))
			return problem(
				400,
				"Unknown Tier",
				`No such generalisation tier: ${requestedTier}. Choose one of ${Object.keys(
					GEOMETRY_TIERS,
				).join(", ")}.`,
			);
		const simplified = simplifyGeometry(geometry, requestedTier);
		if (!simplified)
			return problem(
				404,
				"Not Found",
				`Every part of that area is smaller than the ${requestedTier} tier keeps. Ask for a finer tier.`,
			);
		return {
			status: 200,
			body: envelope(releaseId, {
				type: "Feature",
				id: [geography, boundaryRelease, code].join("/"),
				properties: {
					id: [geography, boundaryRelease, area.code].join("/"),
					geography,
					boundaryRelease,
					...area,
					generalisation: {
						tier: simplified.tier,
						toleranceM: simplified.toleranceM,
						minEffectiveAreaM2: simplified.minEffectiveAreaM2,
						vertices: simplified.verticesAfter,
						verticesAtFullResolution: simplified.verticesBefore,
						parts: simplified.partsAfter,
						partsAtFullResolution: simplified.partsBefore,
						...(requestedTier === "full"
							? {}
							: { method: GENERALISATION_METHOD }),
					},
					geometrySource: areaGeometryCache.provenance(
						geography as string,
						boundaryRelease as string,
						code as string,
					),
				},
				geometry: simplified.geometry,
			}),
		};
	} catch (error) {
		return problem(
			503,
			"Geometry Unavailable",
			error instanceof Error
				? error.message
				: "Geometry could not be loaded.",
		);
	}
};
