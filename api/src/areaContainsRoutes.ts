import {
	CONTAINMENT_NOTE,
	describeLookupRelease,
	locatePoints,
	parseLookupCoordinate,
	parseLookupCrs,
	parseLookupRequest,
	MAX_STATED_ACCURACY_M,
	parseStatedAccuracy,
	type LookupPoint,
	type LookupInputCrs,
} from "./pointLookup";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** Points a batch lookup accepts; more belongs in a bulk export. */
export const MAX_BATCH_POINTS = 100;

const unavailable = () =>
	problem(
		503,
		"Catalogue Unavailable",
		"Build the geography resolver and geometry source registry before point lookup.",
	);

const coordinateDescription = (crs: string) =>
	crs === "EPSG:4326"
		? "lng (-180 to 180) and lat (-90 to 90) as plain decimal WGS 84 degrees"
		: crs === "EPSG:27700"
			? "easting and northing as plain decimal grid metres, or gridref as an Ordnance Survey National Grid reference"
			: "easting and northing as plain decimal grid metres";

const coordinateCrsProblem = () =>
	problem(
		400,
		"Invalid Query",
		"crs must be EPSG:4326 (the default), EPSG:27700 (British National Grid), or EPSG:29902 (Irish Grid).",
	);

/** Areas of each requested geography that contain a WGS84 point. */
export const handleAreaContainsRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas:contains"
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
	if (!crs) return coordinateCrsProblem();
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
			`${coordinateDescription(crs)} are required for ${crs}.`,
		);
	const geographyResolver = context.geographyResolver;
	const unavailable = geographyResolver.requires("geometry");
	if (unavailable) return unavailable;
	const request = parseLookupRequest(context, parsedUrl.searchParams);
	if ("status" in request) return request;
	const [{ country, results }] = locatePoints(
		context,
		geographyResolver,
		request,
		[point],
	) as [ReturnType<typeof locatePoints>[number]];
	return {
		status: 200,
		body: envelope(releaseId, {
			point,
			...(request.date ? { date: request.date.date } : {}),
			country,
			boundaryRule: "included",
			results: request.releases.map((lookupRelease, index) => ({
				...describeLookupRelease(geographyResolver, lookupRelease),
				...results[index]!,
			})),
			note: CONTAINMENT_NOTE,
		}),
	};
};

const parseBatchPoints = (
	values: string[],
	crs: LookupInputCrs,
	defaultAccuracyM: number | undefined,
): LookupPoint[] | ApiResponse => {
	if (values.length === 0)
		return problem(
			400,
			"Invalid Query",
			"Supply at least one point as point={lng},{lat}; it may be repeated.",
		);
	if (values.length > MAX_BATCH_POINTS)
		return problem(
			400,
			"Invalid Query",
			`At most ${MAX_BATCH_POINTS} points can be looked up in one request; this one has ${values.length}.`,
		);
	const points: LookupPoint[] = [];
	for (const [index, value] of values.entries()) {
		const parts = value.split(",");
		const gridReference =
			crs === "EPSG:27700" && /^[a-z]/i.test(parts[0] ?? "");
		const coordinateParts = gridReference ? 1 : 2;
		const accuracyText = parts[coordinateParts];
		const accuracy = parseStatedAccuracy(accuracyText);
		const point =
			parts.length <= coordinateParts + 1 && accuracy !== null
				? parseLookupCoordinate(
						crs,
						gridReference
							? { gridReference: parts[0] }
							: crs === "EPSG:4326"
								? { lng: parts[0], lat: parts[1] }
								: { easting: parts[0], northing: parts[1] },
						accuracy ?? defaultAccuracyM,
					)
				: undefined;
		if (!point)
			return problem(
				400,
				"Invalid Query",
				`point ${index} (${JSON.stringify(value)}) is not ${crs === "EPSG:4326" ? "{lng},{lat}" : crs === "EPSG:27700" ? "{easting},{northing} or {gridref}" : "{easting},{northing}"}, optionally followed by ,{accuracy}; plain decimals are required except for an Ordnance Survey grid reference in EPSG:27700. Stated accuracy is in metres up to ${MAX_STATED_ACCURACY_M}.`,
			);
		points.push(point);
	}
	return points;
};

/** The same containment lookup for a bounded batch of points. */
export const handleAreaContainsBatchRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas:containsBatch"
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
	if (!crs) return coordinateCrsProblem();
	const points = parseBatchPoints(
		parsedUrl.searchParams.getAll("point"),
		crs,
		accuracy,
	);
	if (!Array.isArray(points)) return points;
	const geographyResolver = context.geographyResolver;
	const unavailable = geographyResolver.requires("geometry");
	if (unavailable) return unavailable;
	const request = parseLookupRequest(context, parsedUrl.searchParams);
	if ("status" in request) return request;
	const located = locatePoints(context, geographyResolver, request, points);
	const statuses = located.flatMap(({ results }) =>
		results.map((result) => result.status),
	);
	return {
		status: 200,
		body: envelope(releaseId, {
			...(request.date ? { date: request.date.date } : {}),
			boundaryRule: "included",
			releases: request.releases.map((lookupRelease) =>
				describeLookupRelease(geographyResolver, lookupRelease),
			),
			summary: {
				points: points.length,
				lookups: statuses.length,
				matched: statuses.filter((status) => status === "matched")
					.length,
				noMatch: statuses.filter((status) => status === "no-match")
					.length,
				outsideCoverage: statuses.filter(
					(status) => status === "outside-coverage",
				).length,
				unresolved: statuses.filter(
					(status) =>
						status !== "matched" &&
						status !== "no-match" &&
						status !== "outside-coverage",
				).length,
				nearBoundary: located.reduce(
					(total, { results }) =>
						total +
						results.filter((result) =>
							result.matches.some((match) => match.nearBoundary),
						).length,
					0,
				),
			},
			points: located.map(({ country, results }, index) => ({
				index,
				point: points[index]!,
				country,
				results: results.map(({ matches, detail, ...result }) => ({
					...result,
					// A release that could not be read explains itself once, in
					// releases; only an answer about this point is repeated here.
					...(detail !== undefined &&
					(result.status === "no-match" ||
						result.status === "outside-coverage")
						? { detail }
						: {}),
					matches: matches.map(({ geometrySource, ...match }) => ({
						...match,
						...(geometrySource.corrections
							? { corrections: geometrySource.corrections }
							: {}),
					})),
				})),
			})),
			note: `${CONTAINMENT_NOTE} Release-wide geometry provenance is given once in releases; a match lists corrections only where one moved that area.`,
		}),
	};
};
