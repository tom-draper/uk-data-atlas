import { unexpectedQueryParameter } from "./runtime/index.ts";
import { handleRoute, handleRouteAsync } from "./routeHandlers";
import type {
	RequestBody,
	RouteDispatchContext,
	RouteRequest,
} from "./runtime/index.ts";
import { problem, type ApiResponse } from "./runtime/index.ts";

import { resolveDimensionRequest } from "./dimensions/dimensionRequests";
import type { Series } from "@uk-data-atlas/measures";
import {
	breakdownResponse,
	restatedResponse,
	seriesResponse,
} from "./dimensions/dimensionResponses";

export { type ApiResponse } from "./runtime/index.ts";

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
	context: RouteDispatchContext,
	body: RequestBody | undefined,
	series?: Series,
	measureSeries?: RouteRequest["measureSeries"],
): RouteRequest | ApiResponse => {
	const parsedUrl = new URL(url ?? "/", "http://localhost");
	const matched = context.operationMatcher?.(parsedUrl.pathname);
	const unexpected = unexpectedQueryParameter(
		matched?.operation,
		method,
		parsedUrl.pathname + parsedUrl.search,
	);
	if (unexpected)
		return problem(
			400,
			"Unknown Query Parameter",
			`This operation does not accept the query parameter ${unexpected.parameter}.`,
			{ code: "unknown_query_parameter", ...unexpected },
		);
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
		...(series ? { series } : {}),
		...(measureSeries ? { measureSeries } : {}),
		dispatch: (nextUrl) => {
			const target = new URL(nextUrl, "http://localhost");
			const targetSegments = target.pathname.split("/").filter(Boolean);
			if (
				series &&
				segments[0] === "v1" &&
				segments[1] === "data" &&
				targetSegments[0] === "v1" &&
				targetSegments[1] === "data" &&
				decodePathSegment(targetSegments[2] ?? "") === segments[2]
			) {
				return routeSeries("GET", nextUrl, context, undefined, series);
			}
			return routeSeries("GET", nextUrl, context);
		},
	};
};

/** Route a request with its selected series, when one was resolved. */
const routeSeries = (
	method: string | undefined,
	url: string | undefined,
	context: RouteDispatchContext,
	body?: RequestBody,
	series?: Series,
	measureSeries?: RouteRequest["measureSeries"],
): ApiResponse => {
	if (method !== "GET" && method !== "POST") return methodNotAllowed();
	const request = buildRequest(
		method,
		url,
		context,
		body,
		series,
		measureSeries,
	);
	if ("status" in request) return request;
	return handleRoute(request) ?? notFound();
};

const routeSeriesAsync = async (
	method: string | undefined,
	url: string | undefined,
	context: RouteDispatchContext,
	body?: RequestBody,
	series?: Series,
	measureSeries?: RouteRequest["measureSeries"],
): Promise<ApiResponse> => {
	if (method !== "GET" && method !== "POST")
		return routeSeries(method, url, context, body, series, measureSeries);
	const request = buildRequest(
		method,
		url,
		context,
		body,
		series,
		measureSeries,
	);
	if ("status" in request) return request;
	return (await handleRouteAsync(request)) ?? notFound();
};

/**
 * The response with the request it was read as, in measure-and-filter form. A
 * path the route itself canonicalised, such as `latest`, is kept.
 */
const withLocation = (response: ApiResponse, location: string): ApiResponse => {
	const target = new URL(location, "http://localhost");
	const routed = response.headers?.["content-location"];
	if (routed) target.pathname = new URL(routed, "http://localhost").pathname;
	return {
		...response,
		headers: {
			...response.headers,
			"content-location": target.pathname + target.search,
		},
	};
};

/**
 * Route a request against named, independently-built catalogues. Keeping the
 * dependencies in one object prevents a newly added artifact from silently
 * shifting a long positional argument list at every call site.
 *
 * A request naming a measure and dimension filters is first read as the
 * series it means, or the several it answers together.
 */
export const route = (
	method: string | undefined,
	url: string | undefined,
	context: RouteDispatchContext,
	body?: RequestBody,
): ApiResponse => {
	const resolved = resolveDimensionRequest(url ?? "/", context);
	switch (resolved.kind) {
		case "unchanged":
			return routeSeries(method, url, context, body);
		case "problem":
			return resolved.response;
		case "rewritten":
			return withLocation(
				restatedResponse(
					routeSeries(
						method,
						resolved.url,
						context,
						body,
						undefined,
						resolved.read.map(({ measure, series }) => ({
							measureId: measure.id,
							series,
						})),
					),
					resolved.read,
				),
				resolved.location,
			);
		case "series":
			return seriesResponse(
				routeSeries(
					method,
					resolved.url,
					context,
					body,
					resolved.series,
				),
				resolved.series,
				resolved.reading,
			);
		case "breakdown":
			return breakdownResponse(
				resolved.entries.map(({ url: entryUrl, series }) => ({
					series,
					response: routeSeries(
						method,
						entryUrl,
						context,
						body,
						series,
					),
				})),
				resolved.reading,
			);
	}
};

export const routeAsync = async (
	method: string | undefined,
	url: string | undefined,
	context: RouteDispatchContext,
	body?: RequestBody,
): Promise<ApiResponse> => {
	const resolved = resolveDimensionRequest(url ?? "/", context);
	switch (resolved.kind) {
		case "unchanged":
			return routeSeriesAsync(method, url, context, body);
		case "problem":
			return resolved.response;
		case "rewritten":
			return withLocation(
				restatedResponse(
					await routeSeriesAsync(
						method,
						resolved.url,
						context,
						body,
						undefined,
						resolved.read.map(({ measure, series }) => ({
							measureId: measure.id,
							series,
						})),
					),
					resolved.read,
				),
				resolved.location,
			);
		case "series":
			return seriesResponse(
				await routeSeriesAsync(
					method,
					resolved.url,
					context,
					body,
					resolved.series,
				),
				resolved.series,
				resolved.reading,
			);
		case "breakdown":
			return breakdownResponse(
				await Promise.all(
					resolved.entries.map(async ({ url: entryUrl, series }) => ({
						series,
						response: await routeSeriesAsync(
							method,
							entryUrl,
							context,
							body,
							series,
						),
					})),
				),
				resolved.reading,
			);
	}
};
