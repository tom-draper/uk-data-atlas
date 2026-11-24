import { measure } from "../../declaration/measures.ts";
import type {
	DeclaredDimension,
	DeclaredField,
} from "../../declaration/statistics.ts";
import type {
	DeclaredStatistics,
	IndicatorDeclaration,
} from "../../declaration/dataset.ts";

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
/**
 * What breaks the series, for the measures that hold more than one year. The
 * tables are the revised edition of each year from 2012 to 2024 and the
 * provisional edition for 2025.
 */
const SERIES_NOTE =
	" From 2021 the survey codes occupations to SOC 2020 instead of SOC 2010, which changes the weights every estimate is built from, so 2021 onward is not directly comparable with earlier years. Estimates for 2020 and 2021 come from a smaller sample and include furloughed employees, and the publisher advises caution with them. The 2025 figures are provisional.";

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
		"by-dimension",
		"none",
		"Gross annual pay of employees, from the Annual Survey of Hours and Earnings. Annual pay covers employees in the same job for more than a year." +
			SERIES_NOTE,
	),
	measure(
		"gross-hourly-pay",
		"Gross hourly pay",
		"gbp per hour",
		"by-dimension",
		"none",
		"Gross hourly pay of employees, including overtime, from the Annual Survey of Hours and Earnings." +
			SERIES_NOTE,
	),
	measure(
		"gross-annual-pay-change",
		"Change in gross annual pay",
		"percent",
		"by-dimension",
		"none",
		"Percentage change in gross annual pay on the previous year, as the tables publish it. The tables leave it blank for 2018 to 2022. It is not adjusted for changes in the make-up of the workforce.",
	),
	measure(
		"gross-hourly-pay-change",
		"Change in gross hourly pay",
		"percent",
		"by-dimension",
		"none",
		"Percentage change in gross hourly pay on the previous year, as the tables publish it. The tables leave it blank for 2018 to 2022. It is not adjusted for changes in the make-up of the workforce.",
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

/**
 * The mean pay indicators both pay datasets publish beside their medians,
 * named with `infix` where the dataset's ids carry one. A mean, unlike a
 * median, combines over areas when weighted by the jobs it averages.
 */
export const meanPayIndicators = (
	place: "residence" | "workplace",
	infix = "",
): IndicatorDeclaration[] =>
	(["annual", "hourly"] as const).map((period) => ({
		id: `mean-${infix}${period}-pay`,
		label: `Mean gross ${period} ${place === "workplace" ? "workplace " : ""}pay`,
		field: `${period}.mean`,
		valueKind: "currency",
		unit: period === "annual" ? "£ per year" : "£ per hour",
		aggregation: {
			kind: "weighted-mean",
			weight: {
				description:
					"Employee jobs in the earnings survey, which the mean is taken over.",
				datasetField: `${period}.numberOfJobs`,
			},
		},
		notes: [
			period === "annual"
				? "Annual pay is estimated only for employees who have been in the same job for at least a year."
				: "Gross hourly pay includes overtime pay and overtime hours; the publisher's separate table excluding overtime is not served.",
			"A mean is pulled up by the highest earners, so it sits above the median.",
		],
		measure: `gross-${period}-pay`,
		members: { "earnings-place": place, "pay-statistic": "mean" },
	}));

/**
 * Pay tables cover England, Wales and Scotland with their nations, regions,
 * counties and authorities. Each year is on the authorities in force for that
 * survey, so earlier years reach the releases of 2016, 2019 and 2020 too.
 */
const payAreas = {
	alsoIn: [
		{ geography: "country", year: 2025 },
		{ geography: "region", year: 2025 },
		{ geography: "countyAndUnitaryAuthority", year: 2025 },
		{ geography: "localAuthority", year: 2020 },
		{ geography: "localAuthority", year: 2019 },
		{ geography: "localAuthority", year: 2016 },
	],
	exclude: [
		{
			codes: /^E100000(02|06|09|21|23|27)$/,
			reason: "Buckinghamshire, Cumbria, Dorset, Northamptonshire, North Yorkshire and Somerset were counties of two tiers until 2023 and have no boundary release in the atlas, which holds the county areas that are still in force. Their districts are held.",
		},
	],
};

/** The statistics both pay datasets share, for earnings measured at `place`. */
export const payStatistics = (
	place: "residence" | "workplace",
): Pick<
	DeclaredStatistics,
	"alsoIn" | "exclude" | "measures" | "dimensions" | "fields"
> => ({
	...payAreas,
	measures: PAY_MEASURES,
	dimensions: [PAY_STATISTICS, PAY_PERIOD, EARNINGS_PLACE],
	fields: payFields(place),
});

export const medianPaySeries = () =>
	(["residence", "workplace"] as const).flatMap((place) =>
		payFields(place)
			.filter((field) => field.path.endsWith(".median"))
			.map((field) => ({
				id: `median-${place === "workplace" ? "workplace-" : ""}${field.path.split(".")[0]}-pay`,
				measure: field.measure,
				dimensions: field.members!,
			})),
	);
