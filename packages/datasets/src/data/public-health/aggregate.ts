import { PUBLIC_HEALTH_MEASURES, type PublicHealthRecord } from "./loader.ts";

/** Regional summaries are unweighted means of the authorities' estimates. */
export function averagePublicHealth(
	records: PublicHealthRecord[],
): PublicHealthRecord | null {
	if (!records.length) return null;
	const metrics: PublicHealthRecord["metrics"] = {};
	for (const { value: key } of PUBLIC_HEALTH_MEASURES) {
		const values = records.flatMap((record) => {
			const value = record.metrics[key];
			return value === undefined ? [] : [value];
		});
		if (values.length)
			metrics[key] = values.reduce((a, b) => a + b, 0) / values.length;
	}
	return { code: "", name: "", metrics, isAverage: true };
}
