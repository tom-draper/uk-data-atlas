import type {
	AggregatedNHSWaitingData,
	NHSWaitingICBData,
} from "../../types/nhsWaiting.ts";

/** Sums the distinct boards the selected areas belong to; the share is recomputed. */
export const aggregateNHSWaiting = (
	records: NHSWaitingICBData[],
): AggregatedNHSWaitingData | null => {
	let total = 0,
		over18Weeks = 0;
	for (const record of records) {
		total += record.total;
		over18Weeks += record.over18Weeks;
	}
	return total === 0
		? null
		: { total, over18Weeks, pctOver18Weeks: (over18Weeks / total) * 100 };
};
