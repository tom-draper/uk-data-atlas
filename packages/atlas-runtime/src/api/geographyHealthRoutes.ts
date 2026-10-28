import { envelope, invalidQuery, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "../areas/routing";
import { geographyHealthReport } from "../catalogue/geographyHealthReport";
import { choices, readChoice } from "./queryParameters";
const HEALTH = {
	reach: { values: ["connected", "vintage-only", "isolated"] },
} as const;

export const handleGeographyHealthRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "geography-health"
	)
		return undefined;
	const geographyResolver = context.geographyResolver;
	const geography = parsedUrl.searchParams.get("geography");
	const country = parsedUrl.searchParams.get("country");
	// An empty reach filters nothing, as an absent one does.
	const reach = parsedUrl.searchParams.get("reach");
	if (reach && readChoice(reach, HEALTH.reach) === null)
		return invalidQuery(`reach must be ${choices(HEALTH.reach)}.`);
	return {
		status: 200,
		body: envelope(
			releaseId,
			geographyHealthReport(geographyResolver, {
				geography,
				country,
				reach,
			}),
		),
	};
};
