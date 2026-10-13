import type { AreaRelation } from "./areaRelationships";
import {
	envelope,
	invalidQuery,
	problem,
	type ApiResponse,
} from "./routeResponse";
import type { RouteRequest } from "./routing";
import { readWholeNumber } from "./queryParameters";
import { QUERY_RULES } from "./queryRules";

const LIMIT = QUERY_RULES["GET /relationships"].limit;

const RELATIONS: AreaRelation[] = [
	"within",
	"contains",
	"successor",
	"predecessor",
	"overlaps",
];

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
	const relationParameter = parsedUrl.searchParams.get("relation");
	const limit = readWholeNumber(parsedUrl.searchParams.get("limit"), LIMIT);
	if (
		!geography ||
		!boundaryRelease ||
		(relationParameter !== null &&
			!RELATIONS.includes(relationParameter as AreaRelation)) ||
		limit === null
	)
		return invalidQuery(
			`geography and release are required; relation must be within, contains, successor, predecessor or overlaps; limit must be an integer from ${LIMIT.minimum} to ${LIMIT.maximum}.`,
		);
	const coverage = context.geographyResolver.relationshipCoverage(
		geography,
		boundaryRelease,
		relationParameter as AreaRelation | undefined,
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
			relation: relationParameter,
			status,
			...(status === "available"
				? {}
				: {
						reason:
							status === "partial"
								? `${coverage.areaCount - coverage.relatedAreaCount} of ${coverage.areaCount} areas have no published${relationParameter ? ` ${relationParameter}` : ""} relationship.`
								: `No published${relationParameter ? ` ${relationParameter}` : ""} relationships cover this release.`,
					}),
			...coverage,
		}),
	};
};
