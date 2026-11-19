import type { FastifyRequest } from "fastify";
import type {
	ApiResponse,
	RequestBody,
	RouteContextFor,
	RouteDispatchContext,
	RouteRequestFor,
} from "../runtime/index.ts";
import { notFound, route, routeAsync } from "../routes";

/**
 * Run a handler written for the request shape the old dispatcher builds from
 * a Fastify request, so its logic moves to Fastify unchanged.
 */
export const legacyHandler =
	(
		context: RouteContextFor<never>,
		handler: (request: RouteRequestFor<never>) => ApiResponse | undefined,
	) =>
	(request: FastifyRequest): ApiResponse => {
		const parsedUrl = new URL(request.url, "http://localhost");
		const answer = handler({
			context,
			releaseId:
				context.atlasRelease?.releaseId ??
				context.boundaryRegistry.contentHash,
			parsedUrl,
			segments: parsedUrl.pathname
				.split("/")
				.filter(Boolean)
				.map(decodeURIComponent),
			dispatch: () => {
				throw new Error("Unexpected dispatch");
			},
		});
		return answer ?? notFound();
	};

/** What a route that reads the geography services is registered with. */
export type ServiceContext = RouteContextFor<never> &
	Partial<RouteDispatchContext>;

/**
 * Answer through the dispatcher's own `route`, for a route that reads the
 * geography services or depends on the retired-id and dimension layers that
 * run before its handler. A contract-only app has no services and never calls
 * it.
 */
export const legacyRoute = (context: ServiceContext) => {
	let services: RouteDispatchContext | undefined;
	return (request: FastifyRequest): ApiResponse => {
		if (
			!context.geographyResolver ||
			!context.areaValidation ||
			!context.postcodes
		)
			throw new Error("Geography services are unavailable");
		services ??= {
			...context,
			geographyResolver: context.geographyResolver,
			areaValidation: context.areaValidation,
			postcodes: context.postcodes,
		} as RouteDispatchContext;
		return route("GET", request.url, services);
	};
};

/**
 * Answer a POST through the dispatcher's own `routeAsync`, with the body the
 * pipeline has read, so the same layers run before the handler as for a GET.
 */
export const legacyPostRoute = (context: ServiceContext) => {
	let services: RouteDispatchContext | undefined;
	return (
		request: FastifyRequest,
		body?: RequestBody,
	): Promise<ApiResponse> => {
		if (
			!context.geographyResolver ||
			!context.areaValidation ||
			!context.postcodes
		)
			throw new Error("Geography services are unavailable");
		services ??= {
			...context,
			geographyResolver: context.geographyResolver,
			areaValidation: context.areaValidation,
			postcodes: context.postcodes,
		} as RouteDispatchContext;
		return routeAsync("POST", request.url, services, body);
	};
};

/**
 * Answer a GET through the dispatcher's own `routeAsync`, for a route whose
 * handler may wait, such as one that samples a remote provider.
 */
export const legacyRouteAsync = (context: ServiceContext) => {
	let services: RouteDispatchContext | undefined;
	return (request: FastifyRequest): Promise<ApiResponse> => {
		if (
			!context.geographyResolver ||
			!context.areaValidation ||
			!context.postcodes
		)
			throw new Error("Geography services are unavailable");
		services ??= {
			...context,
			geographyResolver: context.geographyResolver,
			areaValidation: context.areaValidation,
			postcodes: context.postcodes,
		} as RouteDispatchContext;
		return routeAsync("GET", request.url, services);
	};
};
