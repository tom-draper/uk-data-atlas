import type { RelationshipPurpose } from "./relationshipPaths";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** Discover published conversion paths without attempting an implicit conversion. */
export const handleRelationshipPathRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (segments.length !== 2 || segments[0] !== "v1" || segments[1] !== "relationship-paths") return undefined;
	const from = {
		geography: parsedUrl.searchParams.get("sourceGeography"),
		boundaryRelease: parsedUrl.searchParams.get("sourceRelease"),
	};
	const to = {
		geography: parsedUrl.searchParams.get("targetGeography"),
		boundaryRelease: parsedUrl.searchParams.get("targetRelease"),
	};
	const purpose = parsedUrl.searchParams.get("purpose") as RelationshipPurpose | null;
	if (!from.geography || !from.boundaryRelease || !to.geography || !to.boundaryRelease || !["identity", "membership", "apportion"].includes(purpose ?? "")) {
		return problem(400, "Invalid Query", "sourceGeography, sourceRelease, targetGeography, targetRelease and purpose (identity, membership or apportion) are required.");
	}
	if (!context.geographyResolver) return problem(503, "Catalogue Unavailable", "Build the relationship path inventory before discovering conversion paths.");
	return {
		status: 200,
		body: envelope(releaseId, {
			from,
			to,
			purpose,
			paths: context.geographyResolver.relationshipPaths(
				from as { geography: string; boundaryRelease: string },
				to as { geography: string; boundaryRelease: string },
				purpose as RelationshipPurpose,
			),
		}),
	};
};
