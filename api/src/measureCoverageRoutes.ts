import { measureCoverage } from "./measureCoverage";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** Published code-set coverage assessments for a measure. */
export const handleMeasureCoverageRoutes = ({
	context,
	releaseId,
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
	return coverage
		? { status: 200, body: envelope(releaseId, coverage) }
		: problem(
				404,
				"Not Found",
				"No published measure coverage record matches that id.",
			);
};
