import type { RouteBinding } from "../routeHandlers";

declare module "fastify" {
	interface FastifyContextConfig {
		/** The route family that answers this path, however it is asked. */
		binding?: RouteBinding;
	}
}

/**
 * A route's handler, tagged with the family binding it answers for, so the
 * paths that binding owns can be answered when asked another way.
 */
export const bound = <Handler extends (...args: never[]) => unknown>(
	handler: Handler,
	binding: RouteBinding,
): Handler & { binding: RouteBinding } => Object.assign(handler, { binding });

/** The route config that carries a handler's binding, if it has one. */
export const boundTo = (handler: object) => ({
	binding: (handler as { binding?: RouteBinding }).binding,
});
