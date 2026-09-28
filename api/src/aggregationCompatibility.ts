import type { MeasureSource } from "./dataCatalog";
import type {
	CompatibilityCandidate,
	MeasureCompatibilityInventory,
} from "./measureCompatibility";

/** Return boundary releases whose codes are safe for aggregate coverage checks. */
export const compatibleReleasesForAggregation = ({
	measureCompatibilityInventory,
	measureId,
	source,
	period,
}: {
	measureCompatibilityInventory?: MeasureCompatibilityInventory;
	measureId: string;
	source: MeasureSource;
	period: string;
}): CompatibilityCandidate[] =>
	(
		measureCompatibilityInventory?.measures
			.find((candidate) => candidate.measureId === measureId)
			?.sources.find(
				(candidate) =>
					candidate.datasetId === source.datasetId &&
					candidate.sourceGeography.type ===
						source.sourceGeography.type &&
					candidate.sourceGeography.boundaryYear ===
						source.sourceGeography.boundaryYear &&
					candidate.periods.includes(period),
			)?.candidates ?? []
	).filter(
		(candidate) =>
			candidate.status === "exact-code-set" ||
			candidate.status === "code-set-compatible",
	);
