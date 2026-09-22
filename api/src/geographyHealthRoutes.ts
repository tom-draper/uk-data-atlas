import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

export const handleGeographyHealthRoutes = ({ context, releaseId, parsedUrl, segments }: RouteRequest): ApiResponse | undefined => {
	if (segments.length !== 2 || segments[0] !== "v1" || segments[1] !== "geography-health") return undefined;
	if (!context.geographyResolver) return problem(503, "Catalogue Unavailable", "Build the geography resolver before reporting release health.");
	const geography = parsedUrl.searchParams.get("geography");
	const releases = context.geographyResolver.geographyHealth().filter(
		(release) => !geography || release.geography === geography,
	);
	const priority = { "not-built": 0, unsupported: 1, partial: 2, available: 3 } as const;
	const priorities = [...releases].sort((left, right) =>
		priority[left.status] - priority[right.status] ||
		right.gapCount - left.gapCount ||
		`${left.geography}/${left.boundaryRelease}`.localeCompare(`${right.geography}/${right.boundaryRelease}`),
	).map((release) => ({
		...release,
		href: `/v1/relationship-coverage?geography=${release.geography}&release=${release.boundaryRelease}`,
	}));
	return { status: 200, body: envelope(releaseId, {
		filters: { geography },
		releases,
		priorities,
		priorityNote: "Relationship artifacts not built rank first, then releases with no evidence, then the largest partial coverage gaps.",
		summary: releases.reduce<Record<string, number>>((summary, release) => ({ ...summary, [release.status]: (summary[release.status] ?? 0) + 1 }), {}),
	}) };
};
