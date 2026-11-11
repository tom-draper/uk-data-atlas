import { regionalGdpStatistics } from "@uk-data-atlas/datasets";
import type { DatasetModule } from "@uk-data-atlas/datasets";
import { APRIL_2023_LAD_MERGERS } from "@uk-data-atlas/datasets";
import type { StatisticsPeriod } from "../atlasStatistics.ts";
import {
	type DeclaredDataset,
	type DeclaredDimension,
	type DeclaredField,
	type Json,
	periods,
} from "../declaredStatistics.ts";
import { yearParts } from "../declaredPayload.ts";
import type { DeclaredPayload } from "../declaredStatistics.ts";
import { measure, per100k } from "./measures.ts";

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

export const INCOME: DeclaredDataset = {
	type: "income",
	module: "economy",
	name: "ladName",
	payload: {
		parts: yearParts("income", "localAuthority", 2025, {
			coverageCountries: ["GB-ENG"],
		}),
		code: "ladCode",
	},
	...payAreas,
	measures: PAY_MEASURES,
	dimensions: [PAY_STATISTICS, PAY_PERIOD, EARNINGS_PLACE],
	fields: payFields("residence"),
};

export const WORKPLACE_INCOME: DeclaredDataset = {
	type: "workplaceIncome",
	module: "economy",
	name: "ladName",
	payload: {
		parts: yearParts("workplaceIncome", "localAuthority", 2025, {
			coverageCountries: ["GB-ENG"],
		}),
		code: "ladCode",
	},
	...payAreas,
	measures: PAY_MEASURES,
	dimensions: [PAY_STATISTICS, PAY_PERIOD, EARNINGS_PLACE],
	fields: payFields("workplace"),
};

export const JOBS: DeclaredDataset = {
	type: "jobs",
	module: "economy",
	payload: {
		parts: yearParts("jobs", "localAuthority", 2023, {
			coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
		}),
		code: "ladCode",
	},
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
	...per100k((record) => record.totalJobs),
};

export const BUSINESS_ACTIVITY: DeclaredDataset = {
	type: "businessActivity",
	module: "economy",
	payload: {
		parts: yearParts("businessActivity", "localAuthority", 2025, {
			coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
		}),
		code: "code",
	},
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
	...per100k((record) => record.value, 2024),
};

/** Years to 2003 are April to March; later ones are calendar years. */
const unemploymentPeriod = (key: string) =>
	Number(key) <= 2003
		? periods.financialYear(Number(key))
		: periods.year(Number(key));

/** The most districts any 2023 unitary was formed from. */
const MOST_PREDECESSORS = Math.max(
	...Object.values(APRIL_2023_LAD_MERGERS).map(
		({ predecessors }) => predecessors.length,
	),
);

const periodText = (year: number) =>
	year <= 2003
		? `April ${year} to March ${year + 1}`
		: `January to December ${year}`;

export const UNEMPLOYMENT: DeclaredDataset = {
	type: "unemployment",
	module: "economy",
	payload: {
		parts: () => [
			{
				key: "2021",
				header: {
					id: "unemployment",
					type: "unemployment",
					year: 2021,
					boundaryType: "localAuthority",
					boundaryYear: 2024,
					latestYear: 2021,
					coverageCountries: ["GB-ENG", "GB-SCT", "GB-WLS"],
				},
			},
		],
		code: "ladCode",
		arrays: ["derivedFromPredecessors"],
		/** The compiler publishes no intervals for figures built from predecessors. */
		without: (relations) =>
			relations.has("predecessor")
				? ["rateIntervals", "levelIntervals"]
				: [],
		periodKeys: Array.from({ length: 26 }, (_, index) =>
			String(1996 + index),
		),
		/** The years any area has a rate for, with how each is described. */
		summary: (records) => {
			const years = [
				...new Set(
					Object.values(records).flatMap((record) =>
						Object.keys(
							(record as { rates?: Record<string, Json> })
								.rates ?? {},
						),
					),
				),
			]
				.map(Number)
				.sort((a, b) => a - b);
			return {
				years,
				periodLabels: Object.fromEntries(
					years.map((year) => [year, periodText(year)]),
				),
			};
		},
	},
	name: "ladName",
	period: () => periods.year(2021),
	alsoIn: [
		{ geography: "localAuthority", year: 2019 },
		{ geography: "localAuthority", year: 2015 },
	],
	/** The districts a 2023 unitary's figures were built from, one per index. */
	parents: Array.from({ length: MOST_PREDECESSORS }, (_, index) => ({
		relation: "predecessor",
		code: `derivedFromPredecessors.${index}`,
		release: { geography: "localAuthority", year: 2021 },
	})),
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
	module: "deprivation",
	payload: {
		parts: yearParts(
			"childPoverty",
			"localAuthority",
			2024,
			{
				measure: "relativeLowIncomeBeforeHousingCosts",
			},
			["2022", "2023", "2024", "2025"],
		),
		code: "ladCode",
	},
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
	computed: {
		childrenPopulation: (record) =>
			(record.childCount as number) /
			((record.childPovertyRate as number) / 100),
	},
};

export const REGIONAL_GDP_ITL3: DeclaredDataset = {
	type: "regionalGdpItl3",
	module: "economy",
	...regionalGdpStatistics,
	payload: {
		...regionalGdpStatistics.payload,
		parts: yearParts("regionalGdpItl3", "itl3", 2025, {
			coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
		}),
	},
};

const single = (
	type: string,
	module: DatasetModule,
	period: () => StatisticsPeriod,
	payload: DeclaredPayload,
	...declared: Parameters<typeof measure>
): DeclaredDataset => ({
	type,
	module,
	payload,
	name: "name",
	period,
	measures: [measure(...declared)],
	fields: [{ path: "value", measure: declared[0] }],
});

export const COUNCIL_TAX = single(
	"councilTax",
	"housing",
	() => periods.financialYear(2026),
	{
		parts: yearParts(
			"councilTax",
			"localAuthority",
			2026,
			{ coverageCountries: ["GB-ENG"] },
			["2026"],
		),
		code: "code",
	},
	"band-d-council-tax",
	"Average Band D council tax",
	"gbp",
	"amount",
	"weighted_mean",
	"Average area Band D council tax, including major precepts.",
);

export const LOCAL_GOVERNMENT_FINANCE = single(
	"localGovernmentFinance",
	"economy",
	() => periods.financialYear(2026),
	{
		parts: yearParts(
			"localGovernmentFinance",
			"localAuthority",
			2026,
			{ coverageCountries: ["GB-ENG"] },
			["2026"],
		),
		code: "code",
	},
	"education-services-budget",
	"Education services revenue budget",
	"gbp thousand",
	"amount",
	"sum",
	"Budgeted net revenue expenditure on education services.",
);

export const HOUSING_AFFORDABILITY = single(
	"housingAffordability",
	"housing",
	() => periods.year(2025),
	{
		parts: yearParts(
			"housingAffordability",
			"localAuthority",
			2025,
			{ coverageCountries: ["GB-ENG", "GB-WLS"] },
			["2025"],
		),
		code: "code",
	},
	"house-price-to-earnings-ratio",
	"House price to earnings ratio",
	"ratio",
	"index",
	"none",
	"Median price of existing dwellings divided by median gross annual residence-based earnings.",
);

export const HOUSE_PRICE: DeclaredDataset = {
	type: "housePrice",
	module: "housing",
	payload: {
		parts: yearParts(
			"housePrice",
			"ward",
			2021,
			{ coverageCountries: ["GB-ENG", "GB-WLS"], priceYearsFrom: 1995 },
			["2023"],
		),
		code: "wardCode",
		arrays: ["prices", "meanPrices"],
		emptyArrays: ["prices", "meanPrices"],
		relatedRecords: true,
		sparsePeriods: true,
		/** A price's key is its index from `priceYearsFrom`. */
		periodKeys: Array.from({ length: 80 }, (_, index) => String(index)),
	},
	name: "wardName",
	parents: [
		{
			code: "ladCode",
			name: "ladName",
			release: { geography: "localAuthority", year: 2021 },
			alsoIn: [2023, 2019, 2024].map((year) => ({
				geography: "localAuthority",
				year,
			})),
		},
		// Salford's wards, moved onto their 2021 codes, keep the code they
		// were published under.
		{
			relation: "published-as",
			code: "sourceWardCode",
			release: { geography: "ward", year: 2020 },
		},
	],
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
