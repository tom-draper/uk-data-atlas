import { DISTANCE_METHOD } from "./areaDistance";
import {
	MAX_STATED_ACCURACY_M,
	describeLookupRelease,
	parseLookupPoint,
	parseLookupRequest,
	parseStatedAccuracy,
} from "./pointLookup";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

export const MAX_NEAR_LIMIT = 10;
export const DEFAULT_NEAR_WITHIN_M = 1000;
export const MAX_NEAR_WITHIN_M = 50000;

const wholeNumber = (
	value: string | null,
	fallback: number,
	minimum: number,
	maximum: number,
) => {
	if (value === null) return fallback;
	const parsed = Number(value);
	return /^\d+$/.test(value) && parsed >= minimum && parsed <= maximum
		? parsed
		: undefined;
};

/**
 * The areas of each requested geography nearest a WGS84 point. This is a
 * distance answer: an area at zero metres has the point on or inside it, but
 * containment is only ever claimed by `areas:contains`.
 */
export const handleAreaNearRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas:near"
	)
		return undefined;
	const { searchParams } = parsedUrl;
	const accuracy = parseStatedAccuracy(searchParams.get("accuracy"));
	if (accuracy === null)
		return problem(
			400,
			"Invalid Query",
			`accuracy must be a positive number of metres, at most ${MAX_STATED_ACCURACY_M}.`,
		);
	const point = parseLookupPoint(
		searchParams.get("lng") ?? undefined,
		searchParams.get("lat") ?? undefined,
		accuracy,
	);
	if (!point)
		return problem(
			400,
			"Invalid Query",
			"lng (-180 to 180) and lat (-90 to 90) are required as plain decimal WGS 84 degrees.",
		);
	const limit = wholeNumber(searchParams.get("limit"), 1, 1, MAX_NEAR_LIMIT);
	if (limit === undefined)
		return problem(
			400,
			"Invalid Query",
			`limit must be a whole number from 1 to ${MAX_NEAR_LIMIT}.`,
		);
	const withinM = wholeNumber(
		searchParams.get("within"),
		DEFAULT_NEAR_WITHIN_M,
		1,
		MAX_NEAR_WITHIN_M,
	);
	if (withinM === undefined)
		return problem(
			400,
			"Invalid Query",
			`within must be a whole number of metres from 1 to ${MAX_NEAR_WITHIN_M}.`,
		);
	const { geographyResolver } = context;
	if (!geographyResolver?.hasAreaGeometryCache())
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the geography resolver and geometry source registry before nearest-area lookup.",
		);
	const request = parseLookupRequest(context, searchParams);
	if ("status" in request) return request;
	const results = request.releases.map((lookupRelease) => {
		const description = describeLookupRelease(
			geographyResolver,
			lookupRelease,
		);
		if (lookupRelease.status !== "selected" || "status" in description)
			return { ...description, nearest: [] };
		const { geography, boundaryRelease } = lookupRelease;
		try {
			const found = geographyResolver.nearestAreas(
				geography,
				boundaryRelease,
				[point.lng, point.lat],
				{ withinM, limit },
			) ?? { matched: 0, nearest: [] };
			return {
				...description,
				status: found.matched > 0 ? "found" : "none-within",
				matched: found.matched,
				truncated: found.matched > limit,
				nearest: found.nearest.map((area, index) => ({
					rank: index + 1,
					...area,
					distanceM: Math.round(area.distanceM * 10) / 10,
				})),
			};
		} catch (error) {
			return {
				...description,
				status: "geometry-unavailable",
				detail:
					error instanceof Error
						? error.message
						: "Geometry could not be loaded for nearest-area lookup.",
				nearest: [],
			};
		}
	});
	return {
		status: 200,
		body: envelope(releaseId, {
			point,
			...(request.date ? { date: request.date.date } : {}),
			within: withinM,
			limit,
			relation: "distance",
			distanceMethod: DISTANCE_METHOD,
			results,
			note: "Each distance runs from the point to the nearest part of an area's published geometry, and is zero when the point lies on or inside it. It ranks areas by distance and never states containment: use /v1/areas:contains for that. Distances carry the coordinate's own uncertainty, given in point.precision.",
		}),
	};
};
