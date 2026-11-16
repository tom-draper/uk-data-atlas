import type { FastifyPluginAsync } from "fastify";
import type { RouteContextFor } from "../runtime/index.ts";
import { handleDocumentRoutes } from "../documentRoutes";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import { documentContract } from "./documentContract";

export const documentFastifyRoutes: FastifyPluginAsync<{
	context: RouteContextFor<never>;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	registerGetRoute(
		app,
		context,
		documentContract,
		(request) => {
			const parsedUrl = new URL(request.url, "http://localhost");
			const answer = handleDocumentRoutes({
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
			if (!answer) throw new Error(`No response for ${request.url}`);
			return answer;
		},
		dispatch,
	);
};
