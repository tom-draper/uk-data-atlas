import {
	MAX_STATED_ACCURACY_M,
	isProjectedLookupPointInBounds,
	parseLookupCoordinate,
	parseLookupCrs,
	parseStatedAccuracy,
} from "./pointLookup";
import { fromWgs84Point } from "./reprojection";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/**
 * Convert a coordinate without coupling a client to a boundary release. Area
 * lookups use the same parser, so a map can normalise a point first and then
 * reuse its WGS84 coordinate in any other mapping stack.
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
	const targetCrs = parseLookupCrs(parsedUrl.searchParams.get("to"));
	if (!targetCrs)
		return problem(
			400,
			"Invalid Query",
			"to must be EPSG:4326 (the default), EPSG:27700 (British National Grid), or EPSG:29902 (Irish Grid).",
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
	const target =
		targetCrs === "EPSG:4326"
			? undefined
			: (() => {
				const { position, transformation } = fromWgs84Point(
					[point.lng, point.lat],
					targetCrs,
				);
				if (!isProjectedLookupPointInBounds(targetCrs, position)) return null;
				return {
					crs: targetCrs,
					easting: position[0],
					northing: position[1],
					// This is the inverse of the named published operation.
					transformation: { ...transformation!, direction: "inverse" as const },
					uncertaintyM: Math.round(
						(point.precision.uncertaintyM + transformation!.accuracyM) * 100,
					) / 100,
				};
			})();
	if (target === null)
		return problem(
			400,
			"Outside Target CRS",
			`The WGS 84 point cannot be represented within this API's supported ${targetCrs} lookup range.`,
		);
	return {
		status: 200,
		body: envelope(releaseId, {
			point,
			targetCrs,
			...(target ? { target } : {}),
			note: "This is a horizontal-coordinate conversion only. It does not determine altitude, vertical datum or an administrative area.",
		}),
	};
};
