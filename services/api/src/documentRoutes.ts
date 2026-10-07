import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/**
 * Immutable build evidence. These are deliberately documents rather than a
 * second query surface: their schema, bytes and hash are the build output.
 */
export const handleDocumentRoutes = ({
	context,
	releaseId,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 3 ||
		segments[0] !== "v1" ||
		segments[1] !== "documents" ||
		!segments[2]?.endsWith(".json")
	)
		return undefined;
	const id = segments[2].slice(0, -".json".length);
	const document = context.documents?.get(id);
	return document
		? {
				status: 200,
				body: envelope(releaseId, {
					id,
					href: `/v1/documents/${id}.json`,
					contentHash: document.contentHash,
				}),
				representation: {
					contentType: "application/json",
					body: document,
				},
			}
		: problem(404, "Not Found", "No published evidence document matches that id.");
};
