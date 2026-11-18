import type { HousePriceDataset } from "../../../types/housePrice.ts";
import {
	defineDataset,
	noCompiledPayload,
} from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { housePriceStatisticsParts } from "../../../data/house-price/source.ts";
import { aggregateHousePrices } from "./aggregate.ts";

export const housePrice = defineDataset<HousePriceDataset>({
	id: "house-price",
	topic: "prices-and-affordability",
	boundary: { type: "ward", year: 2021 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
	layout: { regionChunks: { kind: "regional" } },
	guide: {
		title: "House Prices",
		about: "The prices homes sold for in each ward of England and Wales, based on Land Registry sales records, going back to 1995. The Atlas shows the median price, the price in the middle of all sales.",
		summary:
			"Median prices paid for homes in every ward in England and Wales, for each year from 1995 to 2022. This was the final ONS ward-level edition, and its partial 2023 is left out because it isn't comparable.",
	},
	source: {
		name: "House Prices",
		publisher: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/peoplepopulationandcommunity/housing/datasets/medianpricepaidbywardhpssadataset37",
		year: "1995-2023",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Median and mean house prices paid by ward for England and Wales. This was the final ONS ward-level edition.",
		cadence: "discontinued",
		notes: [],
	},
	// Table 1a of each workbook, read from inside the published zips.
	load: noCompiledPayload<HousePriceDataset>(),
	statistics: {
		direct: {
			only: true,
			read: ({ xlsSheetRows }) => housePriceStatisticsParts(xlsSheetRows),
		},
		payload: {
			parts: yearParts(
				"house-price",
				"ward",
				2021,
				{
					coverageCountries: ["GB-ENG", "GB-WLS"],
					priceYearsFrom: 1995,
				},
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
	},
	placeHeadline: {
		places: ["ward"],
		order: 10,
		label: "House prices",
		about: "Median price paid for homes sold",
	},
	ranking: {
		label: "Median price paid",
		format: { kind: "count", locale: "en-GB", round: true, prefix: "£" },
	},
	display: {
		label: "House Prices [2023]",
		year: 2023,
		component: "@/components/measures/MeasureSeriesChart",
		series: {
			heading: "House Price",
			headings: {
				median: "Median House Price",
				mean: "Mean House Price",
			},
			period: "1995-2023",
			source: "Office for National Statistics. Final ward-level median and mean house-price data for England and Wales, year ending March 2023. ons.gov.uk",
			accent: "#6366f1",
			measures: {
				median: "house-price-median",
				mean: "house-price-mean",
			},
			combine: "mean",
		},
		measures: [
			{
				id: "median",
				label: "Median",
				field: "prices.2023",
				colorRange: { min: 80000, max: 500000 },
				legend: {
					min: 0,
					max: 1000000,
					format: { kind: "thousands", prefix: "£" },
				},
			},
			{
				id: "mean",
				label: "Mean",
				field: "meanPrices.2023",
				colorRange: { min: 80000, max: 500000 },
				legend: {
					min: 0,
					max: 1000000,
					format: { kind: "thousands", prefix: "£" },
				},
			},
		],
		aggregation: { scope: "ward", aggregate: aggregateHousePrices },
	},
});
