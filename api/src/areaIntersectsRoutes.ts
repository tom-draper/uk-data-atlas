import {
	GENERALISATION_METHOD,
	GEOMETRY_TIERS,
	isGeometryTier,
	simplifyGeometry,
} from "./simplifyGeometry";
import type { RouteRequest } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

/**
 * A box query answers with identities by default, so the cost of a wide box is
 * bounded whether or not the caller asks for coordinates too. The cap is on
 * results rather than on the box: a national box is a reasonable analysis
 * question, and it is the geometry that is expensive, not the extent.
 */
const DEFAULT_INTERSECTS_LIMIT = 200;
const MAX_INTERSECTS_LIMIT = 1000;

/** Areas of one boundary release that intersect a box, with geometry only when a tier is asked for. */
export const handleAreaIntersectsRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas:intersects"
	)
		return undefined;
	const geographyResolver = context.geographyResolver;
	const raw = parsedUrl.searchParams.get("bbox");
	const parts = (raw ?? "").split(",").map((part) => Number(part.trim()));
	const [west, south, east, north] = parts;
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryRelease = parsedUrl.searchParams.get("release");
	if (
		raw === null ||
		parts.length !== 4 ||
		!parts.every((part) => Number.isFinite(part)) ||
		west! < -180 ||
		east! > 180 ||
		south! < -90 ||
		north! > 90 ||
		west! >= east! ||
		south! >= north! ||
		!geography ||
		!boundaryRelease
	) {
		return problem(
			400,
			"Invalid Query",
			"bbox (west,south,east,north in WGS 84, west < east and south < north), geography and release are required.",
		);
	}
	const requestedTier = parsedUrl.searchParams.get("tier");
	if (requestedTier !== null && !isGeometryTier(requestedTier)) {
		return problem(
			400,
			"Unknown Tier",
			`No such generalisation tier: ${requestedTier}. Choose one of ${Object.keys(
				GEOMETRY_TIERS,
			).join(", ")}.`,
		);
	}
	const limitParameter = parsedUrl.searchParams.get("limit");
	const limit =
		limitParameter === null
			? DEFAULT_INTERSECTS_LIMIT
			: Number(limitParameter);
	if (!Number.isInteger(limit) || limit < 1 || limit > MAX_INTERSECTS_LIMIT) {
		return problem(
			400,
			"Invalid Query",
			`limit must be a whole number from 1 to ${MAX_INTERSECTS_LIMIT}.`,
		);
	}
	if (!geographyResolver.hasAreaRelease(geography, boundaryRelease)) {
		return problem(
			404,
			"Not Found",
			"No compiled area release matches the requested geography and release.",
		);
	}
	try {
		const found = geographyResolver.intersectingAreas(
			geography,
			boundaryRelease,
			[west!, south!, east!, north!],
		);
		if (!found)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the geometry source registry before box lookup.",
			);
		const matches = found.matches.slice(0, limit).map((match) => {
			const { geometry, ...area } = match;
			const simplified =
				requestedTier === null
					? undefined
					: simplifyGeometry(geometry, requestedTier);
			return {
				...area,
				...(simplified
					? {
							generalisation: {
								vertices: simplified.verticesAfter,
								verticesAtFullResolution:
									simplified.verticesBefore,
								parts: simplified.partsAfter,
								partsAtFullResolution: simplified.partsBefore,
							},
							geometry: simplified.geometry,
						}
					: {}),
			};
		});
		return {
			status: 200,
			body: envelope(releaseId, {
				bbox: [west!, south!, east!, north!],
				geography,
				boundaryRelease,
				matched: found.matched,
				returned: matches.length,
				limit,
				truncated: found.matched > limit,
				relationRule:
					"within when the area lies entirely inside the box, overlaps when it meets the box without being contained by it. Both are exact: an area is tested against the box itself, not against its bounding box.",
				...(requestedTier === null
					? {
							geometry:
								"Not included. Pass tier to receive it, at the cost of the coordinates.",
						}
					: {
							tier: requestedTier,
							toleranceM: GEOMETRY_TIERS[requestedTier],
							minEffectiveAreaM2:
								GEOMETRY_TIERS[requestedTier] ** 2,
							...(requestedTier === "full"
								? {}
								: {
										generalisationMethod:
											GENERALISATION_METHOD,
									}),
						}),
				matches,
			}),
		};
	} catch (error) {
		return problem(
			503,
			"Geometry Unavailable",
			error instanceof Error
				? error.message
				: "Geometry could not be loaded for box lookup.",
		);
	}
};
