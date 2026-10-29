import { measureCoverage } from "./measureCoverage";
import {
	observationsFor,
	type ObservationArtifacts,
} from "./observationArtifacts";
import type { DataCatalog } from "./dataCatalog";
import type { MeasureCompatibilityInventory } from "./measureCompatibility";

/** Published observation status and boundary-coverage quality for one measure. */
export const measureQuality = (
	dataCatalog: DataCatalog,
	measureCompatibilityInventory: MeasureCompatibilityInventory,
	measureId: string,
	{ measureObservations }: ObservationArtifacts,
) => {
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === measureId,
	);
	const coverage = measureCoverage(
		dataCatalog,
		measureCompatibilityInventory,
		measureId,
	);
	if (!measure || !coverage) return undefined;
	return {
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
			boundaryCoverage: coverage.sources[index]?.boundaryCoverage ?? [],
			periods: source.periods.map((period) => {
				const observations = observationsFor(
					measure.id,
					source,
					period,
					{
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
	};
};
