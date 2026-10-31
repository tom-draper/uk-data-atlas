import { requireGeography } from "@uk-data-atlas/atlas-runtime/api";
import { DISTANCE_METHOD } from "@uk-data-atlas/geography/area-distance";
import {
	MAX_STATED_ACCURACY_M,
	describeLookupRelease,
	lookupLongitude,
	parseLookupCoordinate,
	parseLookupCrs,
	parseLookupRequest,
	parseStatedAccuracy,
} from "../pointLookup";
import {
	envelope,
	invalidQuery,
	type ApiResponse,
} from "@uk-data-atlas/atlas-runtime/api";
import type { RouteRequestFor } from "@uk-data-atlas/atlas-runtime/api";
import { readWholeNumber } from "@uk-data-atlas/atlas-runtime/api";
import { QUERY_RULES } from "../queryRules";

const NEAR = QUERY_RULES["GET /areas:near"];

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
}: RouteRequestFor<"boundaryRelease" | "hasAreaRelease" | "selectReleaseForDate" | "explainAreaAbsence" | "releaseGeometrySource" | "nearestAreas" | "missingRequirement">): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas:near"
	)
		return undefined;
	const { searchParams } = parsedUrl;
	const accuracy = parseStatedAccuracy(searchParams.get("accuracy"));
	if (accuracy === null)
		return invalidQuery(
			`accuracy must be a positive number of metres, at most ${MAX_STATED_ACCURACY_M}.`,
		);
	const crs = parseLookupCrs(searchParams.get("crs"));
	if (!crs)
		return invalidQuery(
			"crs must be EPSG:4326 (the default), EPSG:27700 (British National Grid), or EPSG:29902 (Irish Grid).",
		);
	const point = parseLookupCoordinate(
		crs,
		{
			lng: lookupLongitude(searchParams),
			lat: searchParams.get("lat") ?? undefined,
			easting: searchParams.get("easting") ?? undefined,
			northing: searchParams.get("northing") ?? undefined,
			gridReference: searchParams.get("gridref") ?? undefined,
		},
		accuracy,
	);
	if (!point)
		return invalidQuery(
			crs === "EPSG:4326"
				? "lng (-180 to 180) and lat (-90 to 90) are required as plain decimal WGS 84 degrees."
				: crs === "EPSG:27700"
					? "easting and northing, or gridref as an Ordnance Survey National Grid reference, are required for EPSG:27700."
					: `easting and northing are required as plain decimal grid metres for ${crs}.`,
		);
	const limit = readWholeNumber(searchParams.get("limit"), NEAR.limit);
	if (limit === null)
		return invalidQuery(
			`limit must be a whole number from ${NEAR.limit.minimum} to ${NEAR.limit.maximum}.`,
		);
	const withinM = readWholeNumber(searchParams.get("within"), NEAR.within);
	if (withinM === null)
		return invalidQuery(
			`within must be a whole number of metres from ${NEAR.within.minimum} to ${NEAR.within.maximum}.`,
		);
	const geographyResolver = context.geographyResolver;
	const unavailable = requireGeography(geographyResolver, "geometry");
	if (unavailable) return unavailable;
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
