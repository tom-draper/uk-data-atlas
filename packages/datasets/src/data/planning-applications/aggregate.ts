import type { IndicatorRecord } from "../../types/indicator.ts";

/** The records an application count adds up over, beyond the headline value. */
const STAGES = ["decided", "withdrawn"] as const;

/**
 * Applications are counts, so they add across authorities. A stage is summed
 * only when every authority reports it, so a total never silently leaves one
 * out.
 */
export function sumPlanningRecords(records: IndicatorRecord[]) {
	if (!records.length) return null;
	const value = records.reduce((sum, record) => sum + record.value, 0);
	const metrics = Object.fromEntries(
		STAGES.filter((stage) =>
			records.every((record) => record.metrics?.[stage] !== undefined),
		).map((stage) => [
			stage,
			records.reduce(
				(sum, record) => sum + (record.metrics?.[stage] ?? 0),
				0,
			),
		]),
	);
	return { code: "", name: "", value, metrics };
}
