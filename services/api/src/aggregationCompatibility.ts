import type { MeasureSource } from "@uk-data-atlas/measures";
import type {
	CompatibilityCandidate,
	MeasureCompatibilityInventory,
} from "@uk-data-atlas/catalogue/node";
import type { MeasureDimensions } from "@uk-data-atlas/measures";
import { seriesCompatibility } from "./seriesCompatibility";

/** Return boundary releases whose codes are safe for aggregate coverage checks. */
export const compatibleReleasesForAggregation = ({
	measureCompatibilityInventory,
	measureId,
	seriesKey,
	measureDimensions,
	source,
	period,
}: {
	measureCompatibilityInventory?: MeasureCompatibilityInventory;
	measureId: string;
	seriesKey?: string;
	measureDimensions?: MeasureDimensions;
	source: MeasureSource;
	period: string;
}): CompatibilityCandidate[] =>
	(
		seriesCompatibility(
			measureCompatibilityInventory,
			measureDimensions?.config,
			seriesKey,
			measureId,
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
