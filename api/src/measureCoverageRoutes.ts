import { areaNotFound } from "./areaResources";
import { measureCapability } from "./measureCapability";
import { measureCoverage } from "./measureCoverage";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import { geographyResolverFor, type RouteRequest } from "./routing";

/** Published code-set coverage assessments for a measure. */
export const handleMeasureCoverageRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 4 ||
		segments[0] !== "v1" ||
		segments[1] !== "measures" ||
		segments[3] !== "coverage"
	)
		return undefined;
	const { dataCatalog, measureCompatibilityInventory } = context;
	if (!dataCatalog || !measureCompatibilityInventory)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue and measure compatibility before retrieving measure coverage.",
		);
	const coverage = measureCoverage(
		dataCatalog,
		measureCompatibilityInventory,
		segments[2]!,
	);
	if (!coverage)
		return problem(
			404,
			"Not Found",
			"No published measure coverage record matches that id.",
		);
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryRelease = parsedUrl.searchParams.get("release");
	if ((geography === null) !== (boundaryRelease === null))
		return problem(
			400,
			"Invalid Query",
			"geography and release are given together, to ask whether this measure can be had on that boundary release.",
		);
	if (geography === null || boundaryRelease === null)
		return { status: 200, body: envelope(releaseId, coverage) };
	if (!geographyResolverFor(context).hasAreaRelease(geography, boundaryRelease))
		return areaNotFound(context, geography, boundaryRelease);
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === segments[2],
	)!;
	return {
		status: 200,
		body: envelope(releaseId, {
			...coverage,
			target: {
				geography,
				boundaryRelease,
				...measureCapability(context, measure, {
					geography,
					boundaryRelease,
				}),
			},
		}),
	};
};
