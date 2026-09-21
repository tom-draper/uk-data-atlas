import {
	MAX_STATED_ACCURACY_M,
	parseLookupCoordinate,
	parseLookupCrs,
	parseStatedAccuracy,
} from "./pointLookup";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/**
 * Normalise a coordinate without coupling a client to a boundary release.
 * Area lookups use the same parser, so a map can transform a point first and
 * then reuse its WGS84 coordinate in any other mapping stack.
 */
export const handleCoordinateRoutes = ({
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "coordinates:convert"
	)
		return undefined;
	const accuracy = parseStatedAccuracy(
		parsedUrl.searchParams.get("accuracy"),
	);
	if (accuracy === null)
		return problem(
			400,
			"Invalid Query",
			`accuracy must be a positive number of metres, at most ${MAX_STATED_ACCURACY_M}.`,
		);
	const crs = parseLookupCrs(parsedUrl.searchParams.get("crs"));
	if (!crs)
		return problem(
			400,
			"Invalid Query",
			"crs must be EPSG:4326 (the default), EPSG:27700 (British National Grid), or EPSG:29902 (Irish Grid).",
		);
	const point = parseLookupCoordinate(
		crs,
		{
			lng: parsedUrl.searchParams.get("lng") ?? undefined,
			lat: parsedUrl.searchParams.get("lat") ?? undefined,
			easting: parsedUrl.searchParams.get("easting") ?? undefined,
			northing: parsedUrl.searchParams.get("northing") ?? undefined,
			gridReference: parsedUrl.searchParams.get("gridref") ?? undefined,
		},
		accuracy,
	);
	if (!point)
		return problem(
			400,
			"Invalid Query",
			crs === "EPSG:4326"
				? "lng (-180 to 180) and lat (-90 to 90) are required as plain decimal WGS 84 degrees."
				: crs === "EPSG:27700"
					? "easting and northing, or gridref as an Ordnance Survey National Grid reference, are required for EPSG:27700."
					: "easting and northing are required as plain decimal grid metres for EPSG:29902.",
		);
	return {
		status: 200,
		body: envelope(releaseId, {
			point,
			targetCrs: "EPSG:4326",
			note: "This is a horizontal-coordinate normalisation only. It does not determine altitude, vertical datum or an administrative area.",
		}),
	};
};
