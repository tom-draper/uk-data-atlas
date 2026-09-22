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
		((to.geography === null) !== (to.boundaryRelease === null)) ||
		((to.geography !== null || to.boundaryRelease !== null) &&
			!RELATIONSHIP_PURPOSES.includes(purposeParameter as RelationshipPurpose)) ||
		((to.geography === null && to.boundaryRelease === null) && purposeParameter !== null)
	) {
		return problem(
			400,
			"Invalid Query",
			"sourceGeography and sourceRelease are required. To diagnose one conversion, provide targetGeography, targetRelease and purpose (identity, membership or apportion) together.",
		);
	}
	if (to.geography === null || to.boundaryRelease === null) {
		const source = from as { geography: string; boundaryRelease: string };
		if (!context.geographyResolver.hasAreaRelease(source.geography, source.boundaryRelease)) {
			return {
				status: 200,
				body: envelope(releaseId, {
					from,
					status: "not-built" as const,
					reason: `No compiled area identity artifact is available for ${source.geography}/${source.boundaryRelease}.`,
					capabilities: [],
					missingPrerequisites: [{
						id: "source-areas",
						status: "not-built" as const,
						reason: `No compiled area identity artifact is available for ${source.geography}/${source.boundaryRelease}.`,
					}],
				}),
			};
		}
		const capabilities = context.geographyResolver.relationshipCapabilitiesFrom(
			source,
		);
		return {
			status: 200,
			body: envelope(releaseId, {
				from,
				status: capabilities.length > 0 ? "available" as const : "unsupported" as const,
				...(capabilities.length > 0 ? {} : { reason: `No declared conversion paths start at ${from.geography}/${from.boundaryRelease}.` }),
				capabilities,
			}),
		};
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
