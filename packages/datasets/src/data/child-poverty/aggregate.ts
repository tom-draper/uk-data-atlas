import type {
	AggregatedChildPovertyData,
	ChildPovertyLADData,
} from "../../types/childPoverty.ts";

/** The rate is recomputed from the summed counts, never averaged. */
export function aggregateChildPoverty(
	records: ChildPovertyLADData[],
): AggregatedChildPovertyData | null {
	let childCount = 0,
		childrenPopulation = 0,
		count = 0;
	for (const record of records) {
		childCount += record.childCount;
		childrenPopulation += record.childrenPopulation;
		count++;
	}
	return count === 0 || childrenPopulation === 0
		? null
		: {
				childCount,
				childPovertyRate: (childCount / childrenPopulation) * 100,
			};
}
