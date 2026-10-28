import {
	envelope,
	invalidQuery,
	problem,
	type ApiResponse,
} from "@uk-data-atlas/atlas-runtime/api";
import type { RouteRequest } from "@uk-data-atlas/atlas-runtime/api";
import {
	choices,
	readChoice,
	readWholeNumber,
} from "@uk-data-atlas/atlas-runtime/api";
import { QUERY_RULES } from "./queryRules";

const { limit: LIMIT, relation: RELATION } = QUERY_RULES["GET /relationships"];

/** Summarises actual release coverage, so hierarchy gaps are queryable facts. */
export const handleRelationshipCoverageRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "relationships"
	)
		return undefined;
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryRelease = parsedUrl.searchParams.get("release");
	const relation = readChoice(
		parsedUrl.searchParams.get("relation"),
		RELATION,
	);
	const limit = readWholeNumber(parsedUrl.searchParams.get("limit"), LIMIT);
	if (!geography || !boundaryRelease || relation === null || limit === null)
		return invalidQuery(
			`geography and release are required; relation must be ${choices(RELATION)}; limit must be an integer from ${LIMIT.minimum} to ${LIMIT.maximum}.`,
		);
	const coverage = context.geographyResolver.relationshipCoverage(
		geography,
		boundaryRelease,
		relation,
		limit,
	);
	if (!coverage)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the area identity and relationship artifacts for this release before reporting relationship coverage.",
		);
	const status =
		coverage.relatedAreaCount === coverage.areaCount
			? "available"
			: coverage.relatedAreaCount > 0
				? "partial"
				: "unsupported";
	return {
		status: 200,
		body: envelope(releaseId, {
			geography,
			boundaryRelease,
			relation: relation ?? null,
			status,
			...(status === "available"
				? {}
				: {
						reason:
							status === "partial"
								? `${coverage.areaCount - coverage.relatedAreaCount} of ${coverage.areaCount} areas have no published${relation ? ` ${relation}` : ""} relationship.`
								: `No published${relation ? ` ${relation}` : ""} relationships cover this release.`,
					}),
			...coverage,
		}),
	};
};
