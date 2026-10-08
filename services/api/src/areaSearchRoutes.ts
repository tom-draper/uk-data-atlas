import { paginate } from "./pagination";
import { envelope, invalidQuery, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";
import { areaNotFound } from "./areaResources";
import { latestPublishedBoundaryRelease } from "./pointLookup";

/**
 * List compiled area identities with stable cursor pagination. Finding an
 * area by what a person typed is `/places`.
 */
export const handleAreaSearchRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas"
	)
		return undefined;
	// Without this a search written the old way would quietly list every
	// area instead of finding one.
	const query = parsedUrl.searchParams.get("q");
	if (query !== null)
		return invalidQuery(
			`/v1/areas lists areas and does not search them. Find an area by name, code or postcode with /v1/places?${new URLSearchParams({ q: query })}.`,
		);
	const geographyResolver = context.geographyResolver;
	const unavailable = geographyResolver.requires("area-search");
	if (unavailable) return unavailable;
	const geography = parsedUrl.searchParams.get("geography");
	const requestedRelease = parsedUrl.searchParams.get("release");
	if (
		geography &&
		!context.boundaryRegistry.releases.some(
			(candidate) => candidate.geography === geography,
		)
	)
		return areaNotFound(context, geography);
	if (requestedRelease && !geography)
		return invalidQuery(
			"release filters an area listing only together with geography.",
		);
	const current =
		geography && requestedRelease === "latest"
			? latestPublishedBoundaryRelease(context, geography)
			: undefined;
	if (current && "status" in current) return current;
	const boundaryRelease = current?.id ?? requestedRelease;
	if (
		geography &&
		boundaryRelease &&
		!geographyResolver.hasAreaRelease(geography, boundaryRelease)
	)
		return areaNotFound(context, geography, boundaryRelease);
	const matches = geographyResolver.searchAreas({
		geography,
		boundaryRelease,
	});
	const page = paginate(parsedUrl, matches, {
		keyOf: (area) => area.id,
		subject: "area query",
	});
	if ("problem" in page) return page.problem;
	return {
		status: 200,
		...(current
			? {
					headers: {
						"content-location": `/v1/areas?${new URLSearchParams({
							...(geography ? { geography } : {}),
							release: boundaryRelease ?? "",
						}).toString()}`,
					},
				}
			: {}),
		body: envelope(releaseId, page.items, page.nextCursor),
	};
};
