import {
	cursorFor,
	keyFromCursor,
	MAX_PAGE_SIZE,
	readPageSize,
} from "./pagination";
import { envelope, problem, type ApiResponse } from "./routeResponse";
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
		return problem(
			400,
			"Invalid Query",
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
		return problem(
			400,
			"Invalid Query",
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
	const limit = readPageSize(parsedUrl.searchParams.get("limit"));
	if (limit === undefined)
		return problem(
			400,
			"Invalid Query",
			`limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`,
		);
	const cursor = parsedUrl.searchParams.get("cursor");
	const id = cursor ? keyFromCursor(cursor) : undefined;
	if (cursor && !id)
		return problem(400, "Invalid Query", "cursor is invalid.", {
			code: "invalid_cursor",
		});
	const offset = id ? matches.positionOf(id) + 1 : 0;
	if (id && offset === 0)
		return problem(
			400,
			"Invalid Query",
			"cursor is not valid for this area query.",
			{ code: "invalid_cursor" },
		);
	const areas = matches.slice(offset, offset + limit);
	const last = areas.at(-1);
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
		body: envelope(
			releaseId,
			areas,
			offset + areas.length < matches.length && last
				? cursorFor(last.id)
				: null,
		),
	};
};
