import type { IndicatorRecord } from "@uk-data-atlas/datasets/types/indicator";
export const PLANNING_MEASURES = [
	{ value: "received", label: "Applications received" },
	{ value: "decided", label: "Applications decided" },
	{ value: "withdrawn", label: "Applications withdrawn" },
] as const;
export function planningValue(
	record: IndicatorRecord | undefined,
	measure: (typeof PLANNING_MEASURES)[number]["value"],
) {
	return measure === "received"
		? (record?.value ?? null)
		: (record?.metrics?.[measure] ?? null);
}
export function sumPlanningRecords(records: IndicatorRecord[]) {
	if (!records.length) return null;
	const value = records.reduce((sum, record) => sum + record.value, 0);
	const metrics = Object.fromEntries(
		PLANNING_MEASURES.slice(1)
			.filter(({ value: key }) =>
				records.every((record) => record.metrics?.[key] !== undefined),
			)
			.map(({ value: key }) => [
				key,
				records.reduce(
					(sum, record) => sum + (record.metrics?.[key] ?? 0),
					0,
				),
			]),
	);
	return { code: "", name: "", value, metrics };
}
