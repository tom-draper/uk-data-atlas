import type { AggregatedIndicatorData, IndicatorRecord } from "@/lib/types/indicator";

/** Counts and quantities are source totals, so they aggregate by summing. */
export const aggregateIndicator = (
	records: IndicatorRecord[],
): AggregatedIndicatorData | null =>
	records.length === 0
		? null
		: { value: records.reduce((sum, record) => sum + record.value, 0) };
