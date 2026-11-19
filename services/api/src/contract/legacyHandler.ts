import type { FastifyRequest } from "fastify";
import type {
	ApiResponse,
	RequestBody,
	RouteContextFor,
	RouteDispatchContext,
} from "../runtime/index.ts";
import type { RouteBinding } from "../routeHandlers";
import { notFound, route, routeAsync } from "../routes";
import { bound } from "./routeBinding";

/** What a route that reads the geography services is registered with. */
export type ServiceContext = RouteContextFor<never> &
	Partial<RouteDispatchContext>;

/** A HEAD is answered as the GET it asks the headers of. */
const methodOf = (request: FastifyRequest) =>
	request.method === "HEAD" ? "GET" : request.method;

const withServices = (
	context: ServiceContext,
): (() => RouteDispatchContext) => {
	let services: RouteDispatchContext | undefined;
	return () => {
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
		return services;
	};
};

/**
 * Run a binding's handler for a GET, as the route it is registered for; any
 * other method is answered as the dispatcher does, with the layers that run
 * before a handler. A contract-only app has no services and never calls it.
 */
export const legacyHandler = (
	context: ServiceContext,
	binding: RouteBinding,
) => {
	const services = withServices(context);
	return bound((request: FastifyRequest): ApiResponse => {
		if (methodOf(request) !== "GET")
			return route(
				methodOf(request),
				request.url,
				services(),
				undefined,
				binding,
			);
		const parsedUrl = new URL(request.url, "http://localhost");
		return (
			binding.handle({
				context: context as RouteDispatchContext,
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
			}) ?? notFound()
		);
	}, binding);
};

/**
 * Answer through the dispatcher's own `route`, for a route that reads the
 * geography services or depends on the retired-id and dimension layers that
 * run before its handler.
 */
export const legacyRoute = (context: ServiceContext, binding: RouteBinding) => {
	const services = withServices(context);
	return bound(
		(request: FastifyRequest): ApiResponse =>
			route(
				methodOf(request),
				request.url,
				services(),
				undefined,
				binding,
			),
		binding,
	);
};

/**
 * Answer a POST through the dispatcher's own `routeAsync`, with the body the
 * pipeline has read, so the same layers run before the handler as for a GET.
 */
export const legacyPostRoute = (
	context: ServiceContext,
	binding: RouteBinding,
) => {
	const services = withServices(context);
	return bound(
		(request: FastifyRequest, body?: RequestBody): Promise<ApiResponse> =>
			routeAsync(
				methodOf(request),
				request.url,
				services(),
				body,
				binding,
			),
		binding,
	);
};

/**
 * Answer through the dispatcher's own `routeAsync`, for a route whose
 * handler may wait, such as one that samples a remote provider.
 */
export const legacyRouteAsync = (
	context: ServiceContext,
	binding: RouteBinding,
) => {
	const services = withServices(context);
	return bound(
		(request: FastifyRequest): Promise<ApiResponse> =>
			routeAsync(
				methodOf(request),
				request.url,
				services(),
				undefined,
				binding,
			),
		binding,
	);
};
