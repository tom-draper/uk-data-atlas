import {
	RELATIONSHIP_OPERATIONS,
	type RelationshipOperation,
} from "./geographyResolver";
import type { RelationshipPurpose } from "./relationshipPaths";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

const RELATIONSHIP_PURPOSES: RelationshipPurpose[] = [
	"identity",
	"membership",
	"apportion",
];

/**
 * Selects a conversion path and validates its intended operation without
 * translating a code or aggregating a measure.
 */
export const handleConversionPlanRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "conversion-plan"
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
	const purpose = parsedUrl.searchParams.get("purpose");
	const operation = parsedUrl.searchParams.get("operation");
	if (
		!from.geography ||
		!from.boundaryRelease ||
		!to.geography ||
		!to.boundaryRelease ||
		!RELATIONSHIP_PURPOSES.includes(purpose as RelationshipPurpose) ||
		(operation !== null &&
			!RELATIONSHIP_OPERATIONS.includes(
				operation as RelationshipOperation,
			))
	) {
		return problem(
			400,
			"Invalid Query",
			"sourceGeography, sourceRelease, targetGeography, targetRelease and purpose (identity, membership or apportion) are required; operation must be a supported relationship operation when supplied.",
		);
	}
	const plan = context.geographyResolver.conversionPlan(
		from as { geography: string; boundaryRelease: string },
		to as { geography: string; boundaryRelease: string },
		purpose as RelationshipPurpose,
		operation === null ? undefined : (operation as RelationshipOperation),
	);
	return {
		status: 200,
		body: envelope(releaseId, {
			from,
			to,
			...plan,
			note: "This plan chooses among published paths only. It does not translate codes, allocate values or treat matching identifiers as proof of geographic continuity.",
		}),
	};
};
