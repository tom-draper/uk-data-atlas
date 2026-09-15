import { measureCoverage } from "./measureCoverage";
import { observationsFor } from "./observationArtifacts";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** Published observation status and boundary-coverage quality for one measure. */
export const handleMeasureQualityRoutes = ({
	context,
	releaseId,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 4 ||
		segments[0] !== "v1" ||
		segments[1] !== "measures" ||
		segments[3] !== "quality"
	)
		return undefined;
	const {
		dataCatalog,
		measureCompatibilityInventory,
		measureObservations,
		populationLocalAuthorityObservations,
		populationObservations,
	} = context;
	if (!dataCatalog || !measureCompatibilityInventory)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue and measure compatibility before retrieving measure quality.",
		);
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === segments[2],
	);
	const coverage = measureCoverage(
		dataCatalog,
		measureCompatibilityInventory,
		segments[2]!,
	);
	if (!measure || !coverage)
		return problem(
			404,
			"Not Found",
			"No published measure quality record matches that id.",
		);
	return {
		status: 200,
		body: envelope(releaseId, {
			measure: {
				id: measure.id,
				valueKind: measure.valueKind,
				unit: measure.unit,
				aggregation: measure.aggregation,
				availability: measure.availability,
			},
			sources: measure.sources.map((source, index) => ({
				datasetId: source.datasetId,
				sourceGeography: source.sourceGeography,
				sourceCoverage: source.coverage,
				boundaryCoverage:
					coverage.sources[index]?.boundaryCoverage ?? [],
				periods: source.periods.map((period) => {
					const observations = observationsFor(
						measure.id,
						source,
						period,
						{
							populationObservations,
							populationLocalAuthorityObservations,
							measureObservations,
						},
					);
					const statusCounts = observations?.records.reduce(
						(counts, record) => {
							const status = record.status ?? "unknown";
							counts[status] = (counts[status] ?? 0) + 1;
							return counts;
						},
						{} as Record<string, number>,
					);
					return observations
						? {
								period,
								artifact: observations.artifact,
								contentHash: observations.contentHash,
								recordCount: observations.records.length,
								statusCounts,
							}
						: { period, status: "not-published" as const };
				}),
			})),
			note: "Boundary coverage is code-set compatibility only. Status counts describe source observation records and do not impute missing areas.",
		}),
	};
};
