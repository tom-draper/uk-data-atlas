import type { StatisticsPeriod } from "../atlasStatistics";
import {
	type DeclaredDataset,
	type DeclaredDimension,
	type DeclaredField,
	periods,
} from "../declaredStatistics";
import { PER_100K, measure } from "./measures";

/** Pay, jobs, output, prices and the labour market. */

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

export const INCOME: DeclaredDataset = {
	type: "income",
	name: "ladName",
	rebuild: {},
	...payAreas,
	measures: PAY_MEASURES,
	dimensions: [PAY_STATISTICS, PAY_PERIOD, EARNINGS_PLACE],
	fields: payFields("residence"),
};

export const WORKPLACE_INCOME: DeclaredDataset = {
	type: "workplaceIncome",
	name: "ladName",
	rebuild: {},
	...payAreas,
	measures: PAY_MEASURES,
	dimensions: [PAY_STATISTICS, PAY_PERIOD, EARNINGS_PLACE],
	fields: payFields("workplace"),
};

export const JOBS: DeclaredDataset = {
	type: "jobs",
	name: "ladName",
	measures: [
		measure(
			"total-jobs",
			"Total jobs",
			"jobs",
			"count",
			"sum",
			"Jobs located in the area: employee jobs, self-employment, government-supported trainees and HM Forces.",
		),
	],
	fields: [{ path: "totalJobs", measure: "total-jobs" }],
	derived: PER_100K,
};

export const BUSINESS_ACTIVITY: DeclaredDataset = {
	type: "businessActivity",
	name: "name",
	measures: [
		measure(
			"enterprises",
			"VAT and/or PAYE based enterprises",
			"enterprises",
			"count",
			"sum",
			"Enterprises registered for VAT or PAYE, summed over the published broad industry groups.",
		),
	],
	fields: [{ path: "value", measure: "enterprises" }],
	derived: PER_100K,
};

export const CLAIMANT_COUNT: DeclaredDataset = {
	type: "claimantCount",
	name: "ladName",
	period: () => periods.month(2026, 4),
	alsoIn: [{ geography: "localAuthority", year: 2022 }],
	measures: [
		measure(
			"claimants",
			"Claimants",
			"people",
			"count",
			"sum",
			"People claiming unemployment-related benefits (the claimant count).",
		),
	],
	dimensions: [
		{
			slug: "age-group",
			label: "Age group",
			members: [
				{
					key: "totalCount",
					code: "16-plus",
					label: "Aged 16 and over",
				},
				{
					key: "youthCount",
					code: "16-to-24",
					label: "Aged 16 to 24",
					parent: "totalCount",
				},
			],
		},
	],
	fields: [{ path: "{age-group}", measure: "claimants" }],
	derived: {
		totalRate:
			"Claimants as a percentage of residents aged 16 to 64, computed for current authorities.",
		youthRate: "Derived from the youth share of claimants.",
	},
};

/** Years to 2003 are April to March; later ones are calendar years. */
const unemploymentPeriod = (key: string) =>
	Number(key) <= 2003
		? periods.financialYear(Number(key))
		: periods.year(Number(key));

export const UNEMPLOYMENT: DeclaredDataset = {
	type: "unemployment",
	name: "ladName",
	period: () => periods.year(2021),
	alsoIn: [
		{ geography: "localAuthority", year: 2019 },
		{ geography: "localAuthority", year: 2015 },
	],
	measures: [
		measure(
			"unemployment-rate",
			"Unemployment rate",
			"percent",
			"rate",
			"none",
			"Model-based unemployed residents aged 16 and over as a percentage of the economically active.",
		),
		measure(
			"unemployment-rate-interval",
			"Unemployment rate confidence interval",
			"percentage points",
			"rate",
			"none",
			"Half-width of the published 95% confidence interval around the unemployment rate.",
		),
		measure(
			"unemployed-people",
			"Unemployed people",
			"people",
			"count",
			"sum",
			"Model-based unemployed residents aged 16 and over.",
		),
		measure(
			"unemployed-people-interval",
			"Unemployed people confidence interval",
			"people",
			"count",
			"none",
			"Half-width of the published 95% confidence interval around unemployed people.",
		),
	],
	fields: [
		["rates", "unemployment-rate"],
		["rateIntervals", "unemployment-rate-interval"],
		["levels", "unemployed-people"],
		["levelIntervals", "unemployed-people-interval"],
	].map(([field, measure]) => ({
		path: `${field}.{period}`,
		measure,
		period: unemploymentPeriod,
	})),
};

export const CHILD_POVERTY: DeclaredDataset = {
	type: "childPoverty",
	name: "ladName",
	/** Keys are the financial year's end. */
	period: (key) => periods.financialYear(Number(key) - 1),
	measures: [
		measure(
			"children-in-relative-low-income",
			"Children in relative low income families",
			"children",
			"count",
			"sum",
			"Children under 16 in families with below 60% of median income before housing costs.",
		),
		measure(
			"children-in-relative-low-income-rate",
			"Children in relative low income families, rate",
			"percent",
			"rate",
			"none",
			"Children in relative low income families before housing costs as a percentage of children under 16.",
		),
	],
	fields: [
		{ path: "childCount", measure: "children-in-relative-low-income" },
		{
			path: "childPovertyRate",
			measure: "children-in-relative-low-income-rate",
		},
	],
	derived: {
		childrenPopulation: "Computed by the compiler from the count and rate.",
	},
};

const regionalGdp = (type: string): DeclaredDataset => ({
	type,
	name: "itlName",
	rebuild: {},
	measures: [
		measure(
			"gva",
			"Gross value added",
			"gbp million",
			"amount",
			"sum",
			"Balanced gross value added at current basic prices.",
		),
		measure(
			"gdp",
			"Gross domestic product",
			"gbp million",
			"amount",
			"sum",
			"Gross domestic product at current market prices.",
		),
	],
	fields: [
		{ path: "gvaMillionGbp", measure: "gva" },
		{ path: "gdpMillionGbp", measure: "gdp" },
	],
});
export const REGIONAL_GDP_ITL1 = regionalGdp("regionalGdpItl1");
export const REGIONAL_GDP_ITL2 = regionalGdp("regionalGdpItl2");
export const REGIONAL_GDP_ITL3 = regionalGdp("regionalGdpItl3");

const single = (
	type: string,
	period: () => StatisticsPeriod,
	...declared: Parameters<typeof measure>
): DeclaredDataset => ({
	type,
	rebuild: {},
	name: "name",
	period,
	measures: [measure(...declared)],
	fields: [{ path: "value", measure: declared[0] }],
});

export const COUNCIL_TAX = single(
	"councilTax",
	() => periods.financialYear(2026),
	"band-d-council-tax",
	"Average Band D council tax",
	"gbp",
	"amount",
	"weighted_mean",
	"Average area Band D council tax, including major precepts.",
);

export const LOCAL_GOVERNMENT_FINANCE = single(
	"localGovernmentFinance",
	() => periods.financialYear(2026),
	"education-services-budget",
	"Education services revenue budget",
	"gbp thousand",
	"amount",
	"sum",
	"Budgeted net revenue expenditure on education services.",
);

export const HOUSING_AFFORDABILITY = single(
	"housingAffordability",
	() => periods.year(2025),
	"house-price-to-earnings-ratio",
	"House price to earnings ratio",
	"ratio",
	"index",
	"none",
	"Median price of existing dwellings divided by median gross annual residence-based earnings.",
);

export const HOUSE_PRICE: DeclaredDataset = {
	type: "housePrice",
	name: "wardName",
	alsoIn: [2019, 2020, 2022, 2023, 2024, 2018, 2017, 2016, 2015].map(
		(year) => ({ geography: "ward", year }),
	),
	measures: [
		measure(
			"house-price-median",
			"Median house price",
			"gbp",
			"median",
			"none",
			"Median price paid for residential property sold in the year.",
		),
		measure(
			"house-price-mean",
			"Mean house price",
			"gbp",
			"mean",
			"none",
			"Mean price paid for residential property sold in the year.",
		),
	],
	fields: (_key, header) =>
		[
			["prices", "house-price-median"],
			["meanPrices", "house-price-mean"],
		].map(([field, measure]) => ({
			path: `${field}.{period}`,
			measure,
			period: (index) =>
				periods.year(Number(header.priceYearsFrom) + Number(index)),
		})),
};
