import type { FastifyPluginAsync } from "fastify";
import type {
	RouteContextFor,
	RouteDispatchContext,
} from "@uk-data-atlas/atlas-runtime/api";
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
import { route } from "../routes";
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
			() => {
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
			},
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
			(request) => {
				if (
					!context.geographyResolver ||
					!context.areaValidation ||
					!context.postcodes
				)
					throw new Error("Geography services are unavailable");
				return route("GET", request.url, {
					...context,
					geographyResolver: context.geographyResolver,
					areaValidation: context.areaValidation,
					postcodes: context.postcodes,
				});
			},
			dispatch,
		);
};
