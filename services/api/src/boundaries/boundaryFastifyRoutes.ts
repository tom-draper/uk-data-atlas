import { bound } from "../contract/routeBinding";
import { bindings } from "../routeHandlers";
import type { FastifyPluginAsync } from "fastify";
import type {
	RouteContextFor,
	RouteDispatchContext,
} from "../runtime/index.ts";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import {
	boundaryReleaseDetail,
	resolveBoundary,
	compareBoundary,
	boundaryReleases,
	boundaries,
} from "./boundaryContract";
import { legacyRoute } from "../contract/legacyHandler";
import { listBoundaryReleases, listBoundaries } from "./boundaryRoutes";

export const boundaryFastifyRoutes: FastifyPluginAsync<{
	context: RouteContextFor<never> & Partial<RouteDispatchContext>;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	for (const [definition, handler] of [
		[boundaries, listBoundaries],
		[boundaryReleases, listBoundaryReleases],
	] as const) {
		registerGetRoute(
			app,
			context,
			definition,
			bound(() => {
				if (!context.geographyResolver)
					throw new Error("Geography resolver is unavailable");
				return handler(
					{
						boundaryRegistry: context.boundaryRegistry,
						geographyResolver: context.geographyResolver,
					},
					context.atlasRelease?.releaseId ??
						context.boundaryRegistry.contentHash,
				);
			}, bindings.boundaries),
			dispatch,
		);
	}
	for (const definition of [
		boundaryReleaseDetail,
		resolveBoundary,
		compareBoundary,
	])
		registerGetRoute(
			app,
			context,
			definition,
			legacyRoute(context, bindings.boundaries),
			dispatch,
		);
};
