import type {
	AggregatedIndicatorData,
	IndicatorRecord,
} from "../../types/indicator.ts";

/** Mean of the published area figures, for the website's typical-area card. */
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
