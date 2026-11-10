import type { FastifyPluginAsync } from "fastify";
import { atlasReleaseResponse } from "../runtime/index.ts";
import type { RouteContextFor } from "../runtime/index.ts";
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
