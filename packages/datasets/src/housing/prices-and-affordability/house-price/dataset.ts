import type { HousePriceDataset } from "../../../types/housePrice.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { loadHousePrice } from "../../../data/house-price/loader.ts";

export const housePrice = defineDataset<HousePriceDataset>({
	id: "house-price",
	topic: "prices-and-affordability",
	boundary: { type: "ward", year: 2021 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
	layout: { regionChunks: { kind: "regional" } },
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
	load: ({ xlsSheetRows }) => loadHousePrice(xlsSheetRows),
	statistics: {
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
});
