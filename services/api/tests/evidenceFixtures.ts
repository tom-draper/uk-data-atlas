import { evidenceReport } from "@uk-data-atlas/atlas-runtime/catalogue";
import { route } from "../src/routes";
import type { RouteContext } from "@uk-data-atlas/atlas-runtime/areas";

/** Drive the build-time report adapter using the same input fixtures as its former HTTP operation. */
export const reportRequest = (
	method: string | undefined,
	url: string | undefined,
	context: RouteContext,
) => {
	if (method !== "GET") return route(method, url, context);
	const parsedUrl = new URL(url ?? "/", "http://localhost");
	return (
		evidenceReport({
			context,
			releaseId:
				context.atlasRelease?.releaseId ??
				context.boundaryRegistry.contentHash,
			parsedUrl,
			segments: parsedUrl.pathname.split("/").filter(Boolean),
			dispatch: (next) => route("GET", next, context),
		}) ?? route(method, url, context)
	);
};
