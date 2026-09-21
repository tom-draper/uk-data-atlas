import type {
	AggregatedIndicatorData,
	IndicatorRecord,
} from "@/lib/types/indicator";

/** Counts and quantities are source totals, so they aggregate by summing. */
export const aggregateIndicator = (
	records: IndicatorRecord[],
): AggregatedIndicatorData | null =>
	records.length === 0
		? null
		: { value: records.reduce((sum, record) => sum + record.value, 0) };

/**
 * Some published local-authority figures are shown as a typical area value in
 * the card. Keep that display aggregate separate from source totals so the
 * configured indicators do not overflow their local-area scales.
 */
export const averageIndicator = (
	records: IndicatorRecord[],
): AggregatedIndicatorData | null =>
	records.length === 0
		? null
		: {
				value:
					records.reduce((sum, record) => sum + record.value, 0) /
					records.length,
			};
