import type {
	AggregatedQualificationData,
	QualificationLAData,
} from "../../types/qualification.ts";

/** Sum of the highest-qualification counts over the authorities. */
export function aggregateQualifications(
	records: QualificationLAData[],
): AggregatedQualificationData {
	const total = {
		noQualifications: 0,
		level1: 0,
		level2: 0,
		apprenticeship: 0,
		level3: 0,
		level4Plus: 0,
		other: 0,
		total: 0,
	};
	for (const { breakdown } of records)
		for (const key of Object.keys(total) as Array<keyof typeof total>)
			total[key] += breakdown[key];
	return { breakdown: total };
}
