import { handleRoute, handleRouteAsync } from "./routeHandlers";
import type { RouteContext } from "./routing";
import { problem, type ApiResponse } from "./routeResponse";

export { type ApiResponse } from "./routeResponse";

const decodePathSegment = (segment: string) => {
	try {
		return decodeURIComponent(segment);
	} catch {
		return undefined;
	}
};

type ParsedRoute = {
	releaseId: string;
	parsedUrl: URL;
	segments: string[];
};

const parseRoute = (
	url: string | undefined,
	context: RouteContext,
): ParsedRoute | ApiResponse => {
	const parsedUrl = new URL(url ?? "/", "http://localhost");
	const segments = parsedUrl.pathname
		.split("/")
		.filter(Boolean)
		.map(decodePathSegment);
	if (segments.some((segment) => segment === undefined))
		return problem(
			400,
			"Invalid Path",
			"The request path contains invalid encoding.",
		);
	return {
		releaseId:
			context.atlasRelease?.releaseId ??
			context.boundaryRegistry.contentHash,
		parsedUrl,
		segments: segments as string[],
	};
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
	if (method !== "GET") {
		return problem(405, "Method Not Allowed", "This API is read-only.");
	}
	const parsed = parseRoute(url, context);
	if ("status" in parsed) return parsed;
	return (
		handleRoute({
			context,
			releaseId: parsed.releaseId,
			parsedUrl: parsed.parsedUrl,
			segments: parsed.segments,
			dispatch: (nextUrl) => route("GET", nextUrl, context),
		}) ?? problem(404, "Not Found", "No API resource matches that path.")
	);
};

export const routeAsync = async (
	method: string | undefined,
	url: string | undefined,
	context: RouteContext,
): Promise<ApiResponse> => {
	if (method !== "GET") return route(method, url, context);
	const parsed = parseRoute(url, context);
	if ("status" in parsed) return parsed;
	return (
		(await handleRouteAsync({
			context,
			releaseId: parsed.releaseId,
			parsedUrl: parsed.parsedUrl,
			segments: parsed.segments,
			dispatch: (nextUrl) => route("GET", nextUrl, context),
		})) ?? problem(404, "Not Found", "No API resource matches that path.")
	);
};
