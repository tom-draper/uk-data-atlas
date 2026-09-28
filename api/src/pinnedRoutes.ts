import { handleRoute } from "./routeHandlers";
import { problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/**
 * A resource asked for under the Atlas release that produced it.
 *
 * `/v1/atlas-releases/{release-id}/…` answers exactly what the unpinned path
 * answers, and says so with `Cache-Control: immutable`: the bytes are a
 * function of that release, so there is nothing to revalidate and a client may
 * keep them for a year. This is the form a production map, a saved analysis
 * or a cached tile should cite.
 *
 * Only the release the server currently holds can be answered. The archive
 * keeps release manifests, not the data files behind them, so an older release
 * is refused with `410 Gone` rather than quietly served from the current one.
 * A copy a client already holds stays valid: that is what pinning bought it.
 * The refusal names the release now current so a client can re-pin.
 */
export const handlePinnedRoutes = (
	request: RouteRequest,
): ApiResponse | undefined => {
	const { context, releaseId, segments } = request;
	if (
		segments.length < 4 ||
		segments[0] !== "v1" ||
		segments[1] !== "atlas-releases"
	)
		return undefined;
	const pinned = segments[2]!;

	if (pinned !== releaseId) {
		const known = context.atlasReleaseHistory?.has(pinned);
		return problem(
			known ? 410 : 404,
			known ? "Release No Longer Served" : "Not Found",
			known
				? `Atlas release ${pinned} is recorded but its artifacts are no longer served; its manifest remains at /v1/atlas-releases/${pinned}. The release now served is ${releaseId}.`
				: `No Atlas release ${pinned} is known. The release now served is ${releaseId}.`,
			{ links: { current: `/v1/atlas-releases/${releaseId}` } },
		);
	}

	// Serve the underlying path, telling it that it was reached through a pin
	// so the links it builds stay pinned too.
	const answer = handleRoute({
		...request,
		segments: ["v1", ...segments.slice(3)],
		pinnedTo: pinned,
	});
	if (!answer) return undefined;
	// Only success is marked. A failure is never stored at all, which
	// `httpResponse` decides for every route in one place, so there is nothing
	// to repeat here.
	return { ...answer, cache: "immutable" as const };
};
