import { problem, type ApiResponse } from "./routeResponse";
import { handleRelationshipCapabilityRoutes } from "./relationshipCapabilityRoutes";
import { handleRelationshipCoverageRoutes } from "./relationshipCoverageRoutes";
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
	const conversionParameters = [
		"sourceGeography",
		"sourceRelease",
		"targetGeography",
		"targetRelease",
		"purpose",
		"operation",
		"measure",
	];
	const coverageParameters = ["geography", "release", "relation", "limit"];
	const asksAboutConversion = conversionParameters.some((parameter) =>
		parsedUrl.searchParams.has(parameter),
	);
	const asksAboutCoverage = coverageParameters.some((parameter) =>
		parsedUrl.searchParams.has(parameter),
	);
	if (asksAboutConversion && asksAboutCoverage)
		return problem(
			400,
			"Invalid Query",
			"Supply either a conversion query (sourceGeography/sourceRelease) or a release-coverage query (geography/release), not both.",
		);
	return asksAboutConversion
		? handleRelationshipCapabilityRoutes(request)
		: handleRelationshipCoverageRoutes(request);
};
