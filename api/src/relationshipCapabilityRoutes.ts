import type { RelationshipPurpose } from "./relationshipPaths";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

const RELATIONSHIP_PURPOSES: RelationshipPurpose[] = [
	"identity",
	"membership",
	"apportion",
];

/**
 * Answers a conversion question as an operational capability: paths, their
 * measurable coverage, and the artifacts still required to use them.
 */
export const handleRelationshipCapabilityRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "relationship-capabilities"
	)
		return undefined;
	const from = {
		geography: parsedUrl.searchParams.get("sourceGeography"),
		boundaryRelease: parsedUrl.searchParams.get("sourceRelease"),
	};
	const to = {
		geography: parsedUrl.searchParams.get("targetGeography"),
		boundaryRelease: parsedUrl.searchParams.get("targetRelease"),
	};
	const purposeParameter = parsedUrl.searchParams.get("purpose");
	if (
		!from.geography ||
		!from.boundaryRelease ||
		!to.geography ||
		!to.boundaryRelease ||
		!RELATIONSHIP_PURPOSES.includes(purposeParameter as RelationshipPurpose)
	) {
		return problem(
			400,
			"Invalid Query",
			"sourceGeography, sourceRelease, targetGeography, targetRelease and purpose (identity, membership or apportion) are required.",
		);
	}
	const purpose = purposeParameter as RelationshipPurpose;
	if (!context.geographyResolver)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the area, crosswalk and relationship path inventories before diagnosing conversion capabilities.",
		);
	const capability = context.geographyResolver.relationshipCapability(
		from as { geography: string; boundaryRelease: string },
		to as { geography: string; boundaryRelease: string },
		purpose,
	);
	return {
		status: 200,
		body: envelope(releaseId, {
			from,
			to,
			purpose,
			status: capability.status,
			...(capability.status === "available"
				? {}
				: {
						reason:
							capability.missingPrerequisites[0]?.reason ??
							"A published conversion path has incomplete coverage.",
					}),
			paths: capability.paths,
			missingPrerequisites: capability.missingPrerequisites,
		}),
	};
};
