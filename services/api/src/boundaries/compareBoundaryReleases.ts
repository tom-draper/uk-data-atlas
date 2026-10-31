import type {
	RouteRequestFor,
	ApiResponse,
} from "@uk-data-atlas/atlas-runtime/api";
import {
	envelope,
	invalidQuery,
	problem,
	requireGeography,
	areaNotFound,
	readWholeNumber,
} from "@uk-data-atlas/atlas-runtime/api";
import { QUERY_RULES } from "../queryRules";

const COMPARE = QUERY_RULES["GET /boundary-releases:compare"];

export const compareBoundaryReleases = ({
	context,
	releaseId,
	parsedUrl,
}: Pick<
	RouteRequestFor<
		| "compareBoundaryReleases"
		| "hasAreaRelease"
		| "missingRequirement"
		| "explainAreaAbsence"
	>,
	"context" | "releaseId" | "parsedUrl"
>): ApiResponse => {
	const geographyResolver = context.geographyResolver;
	const geography = parsedUrl.searchParams.get("geography")?.trim();
	const from = parsedUrl.searchParams.get("from")?.trim();
	const to = parsedUrl.searchParams.get("to")?.trim();
	const limit = readWholeNumber(
		parsedUrl.searchParams.get("limit"),
		COMPARE.limit,
	);
	if (!geography || !from || !to)
		return invalidQuery(
			"geography, from and to are required boundary release ids.",
		);
	if (limit === null)
		return invalidQuery(
			`limit must be an integer from ${COMPARE.limit.minimum} to ${COMPARE.limit.maximum}.`,
		);
	if (from === to)
		return invalidQuery(
			"from and to must name different boundary releases.",
		);
	const unavailable = requireGeography(geographyResolver, "areas");
	if (unavailable) return unavailable;
	if (!geographyResolver.hasAreaRelease(geography, from))
		return areaNotFound(context, geography, from);
	if (!geographyResolver.hasAreaRelease(geography, to))
		return areaNotFound(context, geography, to);
	const comparison = geographyResolver.compareBoundaryReleases(
		geography,
		from,
		to,
		limit,
	);
	if (!comparison)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the compiled area identities before comparing boundary releases.",
		);
	return {
		status: 200,
		body: envelope(releaseId, {
			...comparison,
			limit,
			note: "Code-set differences are reported as identifiers present in only one release, not as proof that a place was added or removed. Extent continuity is available only where a dedicated geometric comparison published it; changed, indeterminate and unmeasured extents remain evidence for review rather than a conversion claim.",
		}),
	};
};
