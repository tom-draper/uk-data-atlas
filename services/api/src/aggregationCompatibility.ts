import type { MeasureSource } from "@uk-data-atlas/measures";
import type {
	CompatibilityCandidate,
	MeasureCompatibilityInventory,
} from "@uk-data-atlas/catalogue/node";
import { seriesCompatibility } from "./seriesCompatibility";

/** Return boundary releases whose codes are safe for aggregate coverage checks. */
export const compatibleReleasesForAggregation = ({
	measureCompatibilityInventory,
	seriesKey,
	source,
	period,
}: {
	measureCompatibilityInventory?: MeasureCompatibilityInventory;
	seriesKey?: string;
	source: MeasureSource;
	period: string;
}): CompatibilityCandidate[] =>
	(
		seriesCompatibility(
			measureCompatibilityInventory,
			seriesKey,
		)?.sources.find(
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
