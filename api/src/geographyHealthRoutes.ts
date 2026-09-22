import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

export const handleGeographyHealthRoutes = ({ context, releaseId, parsedUrl, segments }: RouteRequest): ApiResponse | undefined => {
	if (segments.length !== 2 || segments[0] !== "v1" || segments[1] !== "geography-health") return undefined;
	if (!context.geographyResolver) return problem(503, "Catalogue Unavailable", "Build the geography resolver before reporting release health.");
	const geography = parsedUrl.searchParams.get("geography");
	const releases = context.geographyResolver.geographyHealth().filter(
		(release) => !geography || release.geography === geography,
	);
	return { status: 200, body: envelope(releaseId, {
		filters: { geography },
		releases,
		summary: releases.reduce<Record<string, number>>((summary, release) => ({ ...summary, [release.status]: (summary[release.status] ?? 0) + 1 }), {}),
	}) };
};
