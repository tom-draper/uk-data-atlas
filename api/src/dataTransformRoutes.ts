import { compareObservations } from "./comparison";
import { isNumericObservation } from "./dataCatalog";
import { observationsFor } from "./observationArtifacts";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";
import { sourceExactProvenance } from "./sourceExactProvenance";

/** Operations that compare or transform source-exact observations. */
export const handleDataTransformRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 4 ||
		segments[0] !== "v1" ||
		segments[1] !== "data" ||
		segments[3] !== "compare"
	)
		return undefined;
	const {
		dataCatalog,
		measureObservations,
		populationLocalAuthorityObservations,
		populationObservations,
	} = context;
	if (!dataCatalog)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue before comparing source-exact observations.",
		);
	const measureId = segments[2]!;
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === measureId,
	);
	if (!measure)
		return problem(
			404,
			"Not Found",
			"No published measure serves comparisons at that path.",
		);
	if (measure.valueKind === "categorical")
		return problem(
			422,
			"Operation Not Supported",
			"Categorical measures have no numeric difference to compare.",
		);
	if (
		["release", "conversion", "aggregate"].some((parameter) =>
			parsedUrl.searchParams.has(parameter),
		)
	)
		return problem(
			422,
			"Operation Not Supported",
			"This source-exact comparison endpoint does not select geometry releases, convert observations or aggregate them.",
		);
	const period = parsedUrl.searchParams.get("period");
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryYear = parsedUrl.searchParams.get("boundaryYear");
	const baselineAreaCode = parsedUrl.searchParams.get("baselineAreaCode");
	const comparisonAreaCode = parsedUrl.searchParams.get("comparisonAreaCode");
	if (!baselineAreaCode || !comparisonAreaCode)
		return problem(
			400,
			"Invalid Query",
			"baselineAreaCode and comparisonAreaCode are required.",
		);
	if (baselineAreaCode === comparisonAreaCode)
		return problem(
			400,
			"Invalid Query",
			"baselineAreaCode and comparisonAreaCode must differ.",
		);
	const source = measure.sources.find(
		(candidate) =>
			candidate.periods.includes(period ?? "") &&
			candidate.sourceGeography.type === geography &&
			String(candidate.sourceGeography.boundaryYear) === boundaryYear,
	);
	if (!source)
		return problem(
			400,
			"Invalid Query",
			`${measureId} supports comparisons only for a published source period, geography and boundary year.`,
		);
	const observations = observationsFor(measureId, source, period!, {
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	});
	if (!observations)
		return problem(
			503,
			"Catalogue Unavailable",
			`The observation artifact for ${measureId} is missing, or does not contain the catalogue's declared source period.`,
		);
	const numericRecords = observations.records.filter(isNumericObservation);
	if (numericRecords.length !== observations.records.length)
		return problem(
			503,
			"Catalogue Unavailable",
			`The observation artifact for ${measureId} does not contain numeric records required for comparison.`,
		);
	const baseline = numericRecords.find(
		(record) => record.areaCode === baselineAreaCode,
	);
	const comparison = numericRecords.find(
		(record) => record.areaCode === comparisonAreaCode,
	);
	if (!baseline || !comparison)
		return problem(
			404,
			"Not Found",
			"One or both requested area codes have no published source-exact observation.",
		);
	return {
		status: 200,
		body: envelope(releaseId, {
			measure,
			source,
			period,
			sourceGeography: source.sourceGeography,
			provenance: sourceExactProvenance({
				atlasRelease: releaseId,
				measure,
				source,
				period: period!,
				observations,
			}),
			comparison: compareObservations(measure, baseline, comparison),
		}),
	};
};
