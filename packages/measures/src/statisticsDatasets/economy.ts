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
