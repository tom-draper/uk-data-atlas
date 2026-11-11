import { weightedMean } from "../../helpers/rates.ts";
import type {
	AggregatedSchoolPerformanceGapData,
	SchoolPerformanceGapMeasures,
} from "../../types/schoolPerformance.ts";

/**
 * Pools each group's Attainment 8 over its own pupils, and takes the gap
 * between the pooled scores. Districts whose cohorts fell below the reporting
 * floor carry a null gap and are skipped, so a region is summarised from the
 * districts that could be measured rather than dragged toward zero.
 */
export function aggregateSchoolPerformanceGap(
	records: SchoolPerformanceGapMeasures[],
): AggregatedSchoolPerformanceGapData | null {
	const measured = records.filter((record) => record.att8Gap != null);
	const att8Disadvantaged = weightedMean(
		measured,
		(record) => record.att8Disadvantaged,
		(record) => record.disadvantagedPupils,
	);
	const att8NotDisadvantaged = weightedMean(
		measured,
		(record) => record.att8NotDisadvantaged,
		(record) => record.notDisadvantagedPupils,
	);
	return att8Disadvantaged === null || att8NotDisadvantaged === null
		? null
		: {
				att8Gap: att8NotDisadvantaged - att8Disadvantaged,
				att8Disadvantaged,
				att8NotDisadvantaged,
			};
}
