import type { FastifyPluginAsync } from "fastify";
import type { RouteContextFor } from "../runtime/index.ts";
import { handleOpenapiRoutes } from "../openapiRoutes";
import { documentation } from "./documentation";
import { openapiDescription } from "./openapiDescription";
import { registerGetRoute, type ContractDispatch } from "./registerGetRoute";

export const documentationRoutes: FastifyPluginAsync<{
	context: RouteContextFor<never>;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	for (const route of [openapiDescription, documentation]) {
		registerGetRoute(
			app,
			context,
			route,
			() => {
				const answer = handleOpenapiRoutes({
					context,
					releaseId:
						context.atlasRelease?.releaseId ??
						context.boundaryRegistry.contentHash,
					parsedUrl: new URL(route.path, "http://localhost"),
					segments: ["v1", route.path.slice(1)],
					dispatch: () => {
						throw new Error("Unexpected dispatch");
					},
				});
				if (!answer) throw new Error(`No response for ${route.path}`);
				return answer;
			},
			dispatch,
		);
	}
};
