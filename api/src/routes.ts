import { handleRoute } from "./routeHandlers";
import type { RouteContext } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

export { type ApiResponse } from "./routeResponse";

const decodePathSegment = (segment: string) => {
	try {
		return decodeURIComponent(segment);
	} catch {
		return undefined;
	}
};

/**
 * Route a request against named, independently-built catalogues. Keeping the
 * dependencies in one object prevents a newly added artifact from silently
 * shifting a long positional argument list at every call site.
 */
export const route = (
	method: string | undefined,
	url: string | undefined,
	context: RouteContext,
): ApiResponse => {
	const { boundaryRegistry: registry, atlasRelease } = context;
	const releaseId = atlasRelease?.releaseId ?? registry.contentHash;
	if (method !== "GET") {
		return problem(405, "Method Not Allowed", "This API is read-only.");
	}

	const parsedUrl = new URL(url ?? "/", "http://localhost");
	const pathname = parsedUrl.pathname;
	const segments = pathname.split("/").filter(Boolean).map(decodePathSegment);
	if (segments.some((segment) => segment === undefined)) {
		return problem(
			400,
			"Invalid Path",
			"The request path contains invalid encoding.",
		);
	}
	const handledResponse = handleRoute({
		context,
		releaseId,
		parsedUrl,
		segments: segments as string[],
	});
	if (handledResponse) return handledResponse;

	if (segments.length === 1 && segments[0] === "v1") {
		return {
			status: 200,
			body: envelope(releaseId, {
				name: "UK Data Atlas API",
				links: [
					"/v1/geographies",
					"/v1/boundary-releases",
					"/v1/boundary-releases:resolve",
					"/v1/boundary-releases/{type}/{release}",
					"/v1/geography-inventory",
					"/v1/datasets",
					"/v1/datasets/{dataset-id}",
					"/v1/measures",
					"/v1/measures/{measure-id}",
					"/v1/measures/{measure-id}/compatibility",
					"/v1/measures/{measure-id}/coverage",
					"/v1/measures/{measure-id}/quality",
					"/v1/data/{measure-id}",
					"/v1/data/{measure-id}/series",
					"/v1/data/{measure-id}/rankings",
					"/v1/data/{measure-id}/change",
					"/v1/data/{measure-id}/value",
					"/v1/places",
					"/v1/data/{measure-id}/compare",
					"/v1/data/{measure-id}/aggregate",
					"/v1/data/{measure-id}/convert",
					"/v1/areas",
					"/v1/areas:contains",
					"/v1/areas:intersects",
					"/v1/areas:validate",
					"/v1/areas/{type}/{release}/{code}",
					"/v1/areas/{type}/{release}/{code}/history",
					"/v1/areas/{type}/{release}/{code}/parents",
					"/v1/areas/{type}/{release}/{code}/children",
					"/v1/areas/{type}/{release}/{code}/children/geometry",
					"/v1/areas/{type}/{release}/{code}/relationships",
					"/v1/areas/{type}/{release}/{code}/neighbours",
					"/v1/areas/{type}/{release}/{code}/overlap",
					"/v1/areas/{type}/{release}/{code}/capabilities",
					"/v1/areas/{type}/{release}/{code}/citation",
					"/v1/areas/{type}/{release}/{code}/geometry",
					"/v1/areas/{type}/{release}/{code}/geometry/metadata",
					"/v1/translations",
					"/v1/attribution",
					"/v1/locations",
					"/v1/locations/{location-id}",
					"/v1/locations/{location-id}/members",
					"/v1/crosswalks",
					"/v1/crosswalks/{crosswalk-id}",
					"/v1/crosswalks/{crosswalk-id}/records",
					"/v1/relationship-candidates",
					"/v1/validation",
					"/v1/validation/boundary-releases/{type}/{release}",
					"/v1/validation/crosswalks/{crosswalk-id}",
					"/v1/validation/measures/{measure-id}",
					"/v1/validation/exports/{export-id}",
					"/v1/exports",
					"/v1/exports/{export-id}",
					"/v1/lookups",
					"/v1/lookups/{lookup-id}",
					"/v1/atlas-release",
					"/v1/atlas-releases",
					"/v1/atlas-releases/{release-id}",
					"/v1/atlas-releases/compare",
				],
			}),
		};
	}

	return problem(404, "Not Found", "No API resource matches that path.");
};
