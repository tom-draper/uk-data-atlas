import { weightedMean } from "../../helpers/rates.ts";
import type {
	AggregatedSchoolPerformanceData,
	SchoolPerformanceMeasures,
} from "../../types/schoolPerformance.ts";

// Reads only the headline measures, so it serves both the local authority
// district and the parliamentary constituency datasets.
export function aggregateSchoolPerformance(
	records: SchoolPerformanceMeasures[],
): AggregatedSchoolPerformanceData | null {
	// Each figure is a share or an average over the area's pupils, so
	// authorities count by how many pupils they have.
	const reporting = records.filter((record) => record.ptL2basics94 != null);
	const pupils = (record: SchoolPerformanceMeasures) => record.pupils;
	const ptL2basics94 = weightedMean(
		reporting,
		(record) => record.ptL2basics94,
		pupils,
	);
	return ptL2basics94 === null
		? null
		: {
				ptL2basics94,
				ptL2basics95: weightedMean(
					reporting,
					(record) => record.ptL2basics95,
					pupils,
				),
				avgAtt8: weightedMean(
					reporting,
					(record) => record.avgAtt8,
					pupils,
				),
				avgP8score: weightedMean(
					reporting,
					(record) => record.avgP8score,
					pupils,
				),
			};
}
