import { unsupported } from "./capability";
import type { RelationshipPurpose } from "./relationshipPaths";

const RELATIONSHIP_PURPOSES: RelationshipPurpose[] = [
	"identity",
	"membership",
	"apportion",
];
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** Discover published conversion paths without attempting an implicit conversion. */
export const handleRelationshipPathRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "relationship-paths"
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
	const purpose = parsedUrl.searchParams.get(
		"purpose",
	) as RelationshipPurpose | null;
	if (
		!from.geography ||
		!from.boundaryRelease ||
		!to.geography ||
		!to.boundaryRelease ||
		!["identity", "membership", "apportion"].includes(purpose ?? "")
	) {
		return problem(
			400,
			"Invalid Query",
			"sourceGeography, sourceRelease, targetGeography, targetRelease and purpose (identity, membership or apportion) are required.",
		);
	}
	if (!context.geographyResolver)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the relationship path inventory before discovering conversion paths.",
		);
	const resolver = context.geographyResolver;
	const endpoints = [
		from as { geography: string; boundaryRelease: string },
		to as { geography: string; boundaryRelease: string },
	] as const;
	const paths = resolver.relationshipPaths(
		...endpoints,
		purpose as RelationshipPurpose,
	);
	// A path published for another purpose between the same releases is the
	// likeliest thing the caller wants instead, so it is named rather than
	// left for them to find.
	const otherPurposes = RELATIONSHIP_PURPOSES.filter(
		(candidate) =>
			candidate !== purpose &&
			resolver.relationshipPaths(...endpoints, candidate).length > 0,
	);
	return {
		status: 200,
		body: envelope(releaseId, {
			from,
			to,
			purpose,
			...(paths.length > 0
				? { status: "available" as const }
				: unsupported(
						`No path is published from ${from.geography}/${from.boundaryRelease} to ${to.geography}/${to.boundaryRelease} for ${purpose}${otherPurposes.length > 0 ? `; one is published for ${otherPurposes.join(" and ")}` : ""}.`,
					)),
			paths,
			...(otherPurposes.length > 0
				? {
						alternatives: otherPurposes.map((candidate) => ({
							purpose: candidate,
							href: `/v1/relationship-paths?sourceGeography=${from.geography}&sourceRelease=${from.boundaryRelease}&targetGeography=${to.geography}&targetRelease=${to.boundaryRelease}&purpose=${candidate}`,
						})),
					}
				: {}),
		}),
	};
};
