import { measure } from "../../declaration/measures.ts";
import type {
	DeclaredDimension,
	DeclaredField,
} from "../../declaration/statistics.ts";
import type { DeclaredStatistics } from "../../declaration/dataset.ts";

/**
 * The Annual Survey of Hours and Earnings tables. Residence-based income and
 * workplace-based pay share one shape and differ only in where earnings are
 * measured, so both read their statistics from here.
 */

const PAY_STATISTICS: DeclaredDimension = {
	slug: "pay-statistic",
	label: "Pay statistic",
	members: [
		{ key: "median", label: "Median" },
		{ key: "mean", label: "Mean" },
		...[
			"p10",
			"p20",
			"p25",
			"p30",
			"p40",
			"p60",
			"p70",
			"p75",
			"p80",
			"p90",
		].map((key) => ({ key, label: `${key.slice(1)}th percentile` })),
	],
};
const PAY_PERIOD: DeclaredDimension = {
	slug: "pay-period",
	label: "Pay period",
	members: [
		{ key: "annual", label: "Annual" },
		{ key: "hourly", label: "Hourly" },
	],
};
const EARNINGS_PLACE: DeclaredDimension = {
	slug: "earnings-place",
	label: "Place earnings are measured",
	members: [
		{ key: "residence", label: "Where employees live" },
		{ key: "workplace", label: "Where employees work" },
	],
};
const PAY_MEASURES = [
	measure(
		"ashe-jobs",
		"Employee jobs in the earnings survey",
		"thousand jobs",
		"count",
		"sum",
		"Employee jobs the Annual Survey of Hours and Earnings estimates pay for, in thousands.",
	),
	measure(
		"gross-annual-pay",
		"Gross annual pay",
		"gbp per year",
		"amount",
		"none",
		"Gross annual pay of employees, from the Annual Survey of Hours and Earnings.",
	),
	measure(
		"gross-hourly-pay",
		"Gross hourly pay",
		"gbp per hour",
		"amount",
		"none",
		"Gross hourly pay of employees, excluding overtime, from the Annual Survey of Hours and Earnings.",
	),
	measure(
		"gross-annual-pay-change",
		"Change in gross annual pay",
		"percent",
		"rate",
		"none",
		"Percentage change in gross annual pay on the previous year.",
	),
	measure(
		"gross-hourly-pay-change",
		"Change in gross hourly pay",
		"percent",
		"rate",
		"none",
		"Percentage change in gross hourly pay on the previous year.",
	),
];

const payFields = (place: "residence" | "workplace"): DeclaredField[] =>
	(["annual", "hourly"] as const).flatMap((period) => {
		const pay = `gross-${period}-pay`;
		const fixed = { "earnings-place": place };
		return [
			{
				path: `${period}.numberOfJobs`,
				measure: "ashe-jobs",
				members: { ...fixed, "pay-period": period },
			},
			...(["median", "mean"] as const).flatMap((statistic) => [
				{
					path: `${period}.${statistic}`,
					measure: pay,
					members: { ...fixed, "pay-statistic": statistic },
					wins: true as const,
				},
				{
					path: `${period}.${statistic}PercentageChange`,
					measure: `${pay}-change`,
					members: { ...fixed, "pay-statistic": statistic },
				},
			]),
			{
				path: `${period}.percentiles.{pay-statistic}`,
				measure: pay,
				members: fixed,
			},
		];
	});

/** Pay tables cover England with its regions and counties as well as districts. */
const payAreas = {
	alsoIn: [
		{ geography: "country", year: 2025 },
		{ geography: "region", year: 2025 },
		{ geography: "countyAndUnitaryAuthority", year: 2025 },
	],
};

/** The statistics both pay datasets share, for earnings measured at `place`. */
export const payStatistics = (
	place: "residence" | "workplace",
): Pick<
	DeclaredStatistics,
	"alsoIn" | "measures" | "dimensions" | "fields"
> => ({
	...payAreas,
	measures: PAY_MEASURES,
	dimensions: [PAY_STATISTICS, PAY_PERIOD, EARNINGS_PLACE],
	fields: payFields(place),
});
