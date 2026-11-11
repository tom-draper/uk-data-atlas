import type { IndicatorRecord } from "../types/indicator.ts";

/**
 * Adds the counts of several records together and reads the headline as one
 * count over another, as a percentage. No records give null.
 */
export function sumMetrics(
	records: IndicatorRecord[],
	of: string,
	over: string,
): IndicatorRecord | null {
	if (!records.length) return null;
	const metrics: Record<string, number> = {};
	for (const record of records)
		for (const [key, count] of Object.entries(record.metrics ?? {}))
			metrics[key] = (metrics[key] ?? 0) + count;
	return {
		code: "",
		name: "",
		value: metrics[over] > 0 ? (metrics[of] / metrics[over]) * 100 : 0,
		metrics,
	};
}
