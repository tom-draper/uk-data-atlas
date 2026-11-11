import type { IncomeLADData } from "../../types/income.ts";

/**
 * Pay is a typical value, not a total: a region's figure is the mean of the
 * authorities' published estimates, for each period and statistic they have.
 */
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
