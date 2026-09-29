import type { ApiResponse } from "./routeResponse";
import {
	handleRelationshipCapabilityRoutes,
} from "./relationshipCapabilityRoutes";
import {
	handleRelationshipCoverageRoutes,
} from "./relationshipCoverageRoutes";
import type { RouteRequest } from "./routing";

/**
 * The public seam for discovering the relationships held by the geography
 * archive. Source and target identities ask about conversion; geography and
 * release ask how completely a release is related to its neighbours.
 */
export const handleRelationshipRoutes = (
	request: RouteRequest,
): ApiResponse | undefined => {
	const { segments, parsedUrl } = request;
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "relationships"
	)
		return undefined;
	return parsedUrl.searchParams.has("sourceGeography") ||
		parsedUrl.searchParams.has("sourceRelease") ||
		parsedUrl.searchParams.has("targetGeography") ||
		parsedUrl.searchParams.has("targetRelease") ||
		parsedUrl.searchParams.has("purpose") ||
		parsedUrl.searchParams.has("operation")
		? handleRelationshipCapabilityRoutes(request)
		: handleRelationshipCoverageRoutes(request);
};
