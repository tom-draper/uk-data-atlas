import { handleRoute, handleRouteAsync } from "./routeHandlers";
import type { RequestBody, RouteContext, RouteRequest } from "./routing";
import { problem, type ApiResponse } from "./routeResponse";

export { type ApiResponse } from "./routeResponse";

const decodePathSegment = (segment: string) => {
	try {
		return decodeURIComponent(segment);
	} catch {
		return undefined;
	}
};

const methodNotAllowed = () =>
	problem(
		405,
		"Method Not Allowed",
		"This API is read-only. It answers GET, and POST only where a request carries more than a URL can, such as a column of codes to match or join.",
	);

const notFound = () =>
	problem(404, "Not Found", "No API resource matches that path.");

/** The request a route family sees, or the problem that says why there is none. */
const buildRequest = (
	method: "GET" | "POST",
	url: string | undefined,
	context: RouteContext,
	body: RequestBody | undefined,
): RouteRequest | ApiResponse => {
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
		context,
		method,
		...(method === "POST" ? { body } : {}),
		releaseId:
			context.atlasRelease?.releaseId ??
			context.boundaryRegistry.contentHash,
		parsedUrl,
		segments: segments as string[],
		dispatch: (nextUrl) => route("GET", nextUrl, context),
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
	body?: RequestBody,
): ApiResponse => {
	if (method !== "GET" && method !== "POST") return methodNotAllowed();
	const request = buildRequest(method, url, context, body);
	if ("status" in request) return request;
	return handleRoute(request) ?? notFound();
};

export const routeAsync = async (
	method: string | undefined,
	url: string | undefined,
	context: RouteContext,
	body?: RequestBody,
): Promise<ApiResponse> => {
	if (method !== "GET") return route(method, url, context, body);
	const request = buildRequest(method, url, context, body);
	if ("status" in request) return request;
	return (await handleRouteAsync(request)) ?? notFound();
};
