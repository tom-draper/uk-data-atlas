import { areaNotFound } from "./areaResources";
import { coveragePlan } from "./coveragePlan";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** What a measure can answer on one release, country by country. */
export const handleCoveragePlanRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 4 ||
		segments[0] !== "v1" ||
		segments[1] !== "measures" ||
		segments[3] !== "coverage-plan"
	)
		return undefined;
	const { dataCatalog, measureCompatibilityInventory, areaLookup } = context;
	if (!dataCatalog || !measureCompatibilityInventory || !areaLookup)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue, measure compatibility and area identities before planning a measure's coverage.",
		);
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryRelease = parsedUrl.searchParams.get("release");
	if (!geography || !boundaryRelease)
		return problem(
			400,
			"Invalid Query",
			"geography and release are required: a coverage plan answers one exact boundary release.",
		);
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === segments[2],
	);
	if (!measure)
		return problem(
			404,
			"Not Found",
			"No published measure matches that id.",
		);
	if (!areaLookup.has(`${geography}/${boundaryRelease}`))
		return areaNotFound(context, geography, boundaryRelease);
	const plan = coveragePlan(context, measure, { geography, boundaryRelease });
	if (!plan)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue, measure compatibility and area identities before planning a measure's coverage.",
		);
	return { status: 200, body: envelope(releaseId, plan) };
};
