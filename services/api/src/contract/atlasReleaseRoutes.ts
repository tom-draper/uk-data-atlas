import type { FastifyPluginAsync } from "fastify";
import { atlasReleaseResponse } from "@uk-data-atlas/atlas-runtime/api";
import type { RouteContextFor } from "@uk-data-atlas/atlas-runtime/api";
import { atlasRelease } from "./atlasRelease";
import { registerGetRoute, type ContractDispatch } from "./registerGetRoute";

export const atlasReleaseRoutes: FastifyPluginAsync<{
	context: RouteContextFor<never>;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	registerGetRoute(
		app,
		context,
		atlasRelease,
		() =>
			atlasReleaseResponse(
				context.atlasRelease,
				context.atlasRelease?.releaseId ??
					context.boundaryRegistry.contentHash,
			),
		dispatch,
	);
};
