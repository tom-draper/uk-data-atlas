import {
	handleAnalysisGeographyRoutes,
	handleGovernanceRoutes,
} from "@uk-data-atlas/atlas-runtime/api";
import { route } from "../src/routes";
import type {
	RouteDispatchContext,
	RouteRequest,
} from "@uk-data-atlas/atlas-runtime/api";

/** Exercise report adapters using the route fixtures. */
export const reportRequest = (
	method: string | undefined,
	url: string | undefined,
	context: RouteDispatchContext,
) => {
	if (method !== "GET") return route(method, url, context);
	const parsedUrl = new URL(url ?? "/", "http://localhost");
	const request: RouteRequest = {
		context: {
			...context,
			areaValidation: context.areaValidation ?? context.geographyResolver,
		},
		releaseId:
			context.atlasRelease?.releaseId ??
			context.boundaryRegistry.contentHash,
		parsedUrl,
		segments: parsedUrl.pathname.split("/").filter(Boolean),
		dispatch: (next) => route("GET", next, context),
	};
	const handler =
		request.segments[1] === "measures"
			? handleAnalysisGeographyRoutes
			: handleGovernanceRoutes;
	return handler(request) ?? route(method, url, context);
};
