import type { FastifyPluginAsync } from "fastify";
import type { RouteContextFor } from "@uk-data-atlas/atlas-runtime/api";
import { handleMeasureExport } from "../bulkRoutes";
import { resolveDimensionRequest } from "../dimensions/dimensionRequests";
import { seriesResponse } from "../dimensions/dimensionResponses";
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
			const resolution = resolveDimensionRequest(request.url, context);
			if (resolution.kind === "problem") return resolution.response;
			const url =
				resolution.kind === "series" ? resolution.url : request.url;
			const parsedUrl = new URL(url, "http://localhost");
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
			const response = canonical
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
			return resolution.kind === "series"
				? seriesResponse(
						response,
						resolution.series,
						resolution.reading,
					)
				: response;
		},
		dispatch,
	);
};
