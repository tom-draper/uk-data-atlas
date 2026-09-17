import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

const coordinate = (value: string | null, minimum: number, maximum: number) => {
	if (value === null || value.trim().length === 0) return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
		? parsed
		: undefined;
};

/** Areas that contain a WGS84 point in one explicit release. */
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
	const longitude = coordinate(parsedUrl.searchParams.get("lng"), -180, 180);
	const latitude = coordinate(parsedUrl.searchParams.get("lat"), -90, 90);
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryRelease = parsedUrl.searchParams.get("release");
	if (
		longitude === undefined ||
		latitude === undefined ||
		!geography ||
		!boundaryRelease
	)
		return problem(
			400,
			"Invalid Query",
			"lng (-180 to 180), lat (-90 to 90), geography and release are required.",
		);
	const { geographyResolver } = context;
	if (!geographyResolver)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the geography resolver before point lookup.",
		);
	if (!geographyResolver.hasAreaRelease(geography, boundaryRelease))
		return problem(
			404,
			"Not Found",
			"No compiled area release matches the requested geography and release.",
		);
	try {
		const matches = geographyResolver.containingAreas(
			geography,
			boundaryRelease,
			[longitude, latitude],
		);
		if (!matches)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the geometry source registry before point lookup.",
			);
		return {
			status: 200,
			body: envelope(releaseId, {
				point: { lng: longitude, lat: latitude },
				geography,
				boundaryRelease,
				boundaryRule: "included",
				matches,
			}),
		};
	} catch (error) {
		return problem(
			503,
			"Geometry Unavailable",
			error instanceof Error
				? error.message
				: "Geometry could not be loaded for point lookup.",
		);
	}
};
