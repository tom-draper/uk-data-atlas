import type { FastifyRequest } from "fastify";
import type {
	ApiResponse,
	RouteContextFor,
	RouteRequestFor,
} from "../runtime/index.ts";

/**
 * Run a handler written for the request shape the old dispatcher builds from
 * a Fastify request, so its logic moves to Fastify unchanged.
 */
export const legacyHandler =
	(
		context: RouteContextFor<never>,
		handler: (request: RouteRequestFor<never>) => ApiResponse | undefined,
	) =>
	(request: FastifyRequest): ApiResponse => {
		const parsedUrl = new URL(request.url, "http://localhost");
		const answer = handler({
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
	};
