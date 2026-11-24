import type { DisplaySeries } from "../../declaration/display.ts";
import { SERIES_NOTE } from "./statistics.ts";

/**
 * The history card both pay datasets share, for earnings measured at
 * `place`. Each card measure reads the pay statistic it names; areas combine
 * as a plain mean of their authorities' figures, as the regional cards did,
 * since a median of medians is not a median.
 */
export const paySeries = (
	place: "residence" | "workplace",
	heading: string,
	source: string,
): DisplaySeries => {
	const pay = (
		period: "annual" | "hourly",
		statistic: "median" | "mean",
	) => ({
		measure: `gross-${period}-pay`,
		dimensions: {
			"pay-statistic": [statistic],
			"earnings-place": [place],
		},
	});
	return {
		heading,
		period: "2012-2025",
		source: source + SERIES_NOTE,
		accent: "#10b981",
		measures: {
			annualMedian: pay("annual", "median"),
			annualMean: pay("annual", "mean"),
			hourlyMedian: pay("hourly", "median"),
			hourlyMean: pay("hourly", "mean"),
		},
		combine: "mean",
		breaks: [
			{
				period: "2021",
				label: "The dashed line marks the move to SOC 2020 in 2021.",
			},
		],
	};
};
