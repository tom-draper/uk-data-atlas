import { payStatistics } from "@uk-data-atlas/datasets";
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
	...payStatistics("residence"),
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
