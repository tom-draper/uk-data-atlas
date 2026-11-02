import type { FastifyPluginAsync } from "fastify";
import type { RouteContextFor } from "@uk-data-atlas/atlas-runtime/api";
import { handleMeasureExport } from "../bulkRoutes";
import { canonicalMeasureRequest } from "../canonicalRequests";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import { measureExport } from "./measureExportContract";

export const measureExportRoutes: FastifyPluginAsync<{
	context: RouteContextFor<never>;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	registerGetRoute(
		app,
		context,
		measureExport,
		(request) => {
			const parsedUrl = new URL(request.url, "http://localhost");
			const routeRequest = {
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
			};
			const canonical = canonicalMeasureRequest(routeRequest);
			const answer = handleMeasureExport(canonical ?? routeRequest);
			return canonical
				? {
						...answer,
						headers: {
							...answer.headers,
							"content-location":
								canonical.parsedUrl.pathname +
								canonical.parsedUrl.search,
						},
					}
				: answer;
		},
		dispatch,
	);
};
