import type { IncomeLADData } from "@uk-data-atlas/datasets/types/income";
export const WORKPLACE_PAY_MEASURES = [
	{
		value: "annualMedian",
		label: "Median annual pay",
		period: "annual",
		stat: "median",
	},
	{
		value: "annualMean",
		label: "Mean annual pay",
		period: "annual",
		stat: "mean",
	},
	{
		value: "hourlyMedian",
		label: "Median hourly pay",
		period: "hourly",
		stat: "median",
	},
	{
		value: "hourlyMean",
		label: "Mean hourly pay",
		period: "hourly",
		stat: "mean",
	},
] as const;
export type WorkplacePaySummary = {
	annual: { median: number | null; mean: number | null } | null;
	hourly: { median: number | null; mean: number | null } | null;
};
export function workplacePay(
	record: WorkplacePaySummary | undefined,
	measure: (typeof WORKPLACE_PAY_MEASURES)[number]["value"],
) {
	const option = WORKPLACE_PAY_MEASURES.find(
		(option) => option.value === measure,
	);
	return option ? (record?.[option.period]?.[option.stat] ?? null) : null;
}
export function averageWorkplacePay(records: IncomeLADData[]) {
	const average = (period: "annual" | "hourly", stat: "median" | "mean") => {
		const values = records.flatMap((record) => {
			const value = record[period]?.[stat];
			return value == null ? [] : [value];
		});
		return values.length
			? values.reduce((a, b) => a + b, 0) / values.length
			: null;
	};
	return {
		annual: {
			median: average("annual", "median"),
			mean: average("annual", "mean"),
		},
		hourly: {
			median: average("hourly", "median"),
			mean: average("hourly", "mean"),
		},
	};
}
