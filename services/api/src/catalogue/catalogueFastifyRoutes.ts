import type { FastifyPluginAsync } from "fastify";
import type { RouteContextFor } from "@uk-data-atlas/atlas-runtime/api";
import { handleCatalogueRoutes } from "./catalogueRoutes";
import { canonicalMeasureRequest } from "../canonicalRequests";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import {
	datasetDetail,
	datasets,
	measureDetail,
	measures,
} from "./catalogueContract";

export const catalogueFastifyRoutes: FastifyPluginAsync<{
	context: RouteContextFor<never>;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	for (const definition of [
		datasets,
		datasetDetail,
		measures,
		measureDetail,
	]) {
		registerGetRoute(
			app,
			context,
			definition,
			(request) => {
				const routeRequest = {
					context,
					releaseId:
						context.atlasRelease?.releaseId ??
						context.boundaryRegistry.contentHash,
					parsedUrl: new URL(request.url, "http://localhost"),
					segments: new URL(request.url, "http://localhost").pathname
						.split("/")
						.filter(Boolean)
						.map(decodeURIComponent),
					dispatch: () => {
						throw new Error("Unexpected dispatch");
					},
				};
				const canonical = canonicalMeasureRequest(routeRequest);
				const answer = handleCatalogueRoutes(canonical ?? routeRequest);
				if (!answer)
					throw new Error(`No response for ${definition.path}`);
				if (!canonical) return answer;
				return {
					...answer,
					headers: {
						...answer.headers,
						"content-location":
							canonical.parsedUrl.pathname +
							canonical.parsedUrl.search,
					},
				};
			},
			dispatch,
		);
	}
};
