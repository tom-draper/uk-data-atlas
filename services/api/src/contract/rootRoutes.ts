import type { FastifyPluginAsync } from "fastify";
import type { RouteContextFor } from "../runtime/index.ts";
import { indexResponse } from "../indexRoutes";
import { getOnlyMethodNotAllowed } from "../routeHandlers";
import { httpResponse } from "../httpResponse";
import { sendFastifyResponse } from "../fastifyResponse";
import { registerGetRoute, type ContractDispatch } from "./registerGetRoute";
import { rootContract } from "./rootContract";

export const rootRoutes: FastifyPluginAsync<{
	context: RouteContextFor<never>;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	registerGetRoute(
		app,
		context,
		rootContract,
		() => {
			return indexResponse(
				context.atlasRelease?.releaseId ??
					context.boundaryRegistry.contentHash,
			);
		},
		dispatch,
	);
	app.post(
		"/",
		{
			schema: { hide: true },
			onRequest: dispatch
				? async (request, reply) =>
						dispatch(request, reply, getOnlyMethodNotAllowed)
				: undefined,
		},
		async (request, reply) =>
			sendFastifyResponse(
				reply,
				httpResponse(request.raw, getOnlyMethodNotAllowed),
			),
	);
};
