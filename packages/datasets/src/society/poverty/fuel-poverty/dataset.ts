import type { FuelPovertyDataset } from "../../../types/fuelPoverty.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { HOUSEHOLDS, measure } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { aggregateFuelPoverty } from "./aggregate.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import {
	FUEL_POVERTY_SOURCE,
	TABLE_OPTIONS,
} from "../../../data/fuel-poverty/source.ts";
import type { DirectRecord } from "../../../declaration/statistics.ts";

export const fuelPoverty = defineDataset<FuelPovertyDataset>({
	id: "fuel-poverty",
	topic: "poverty",
	related: ["energy"],
	boundary: { type: "lsoa", year: 2021 },
	coverageCountries: ["GB-ENG"],
	guide: {
		title: "Fuel Poverty",
		about: "The share of households in each small neighbourhood of England in fuel poverty: living in a home with a poor energy efficiency rating and left below the poverty line after paying for energy.",
		summary:
			"The share of households in fuel poverty in each small neighbourhood of England. The fuel poverty map switches between the household rate and the number of affected households. Area summaries sum household counts and recompute the rate.",
	},
	mapName: "Fuel Poverty",
	source: {
		name: "Fuel Poverty",
		publisher: "Department for Energy Security and Net Zero",
		sourceUrl:
			"https://www.gov.uk/government/collections/fuel-poverty-statistics",
		year: "2024",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Department for Energy Security and Net Zero. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Fuel poverty estimates by Lower-layer Super Output Area in England.",
		cadence: "annual",
		notes: [
			"Households in fuel poverty under the Low Income Low Energy Efficiency measure.",
		],
	},
	layout: { regionChunks: { kind: "regional", lsoaToLad: true } },
	statistics: {
		payload: {
			parts: yearParts(
				"fuel-poverty",
				"lsoa",
				2021,
				{ coverageCountries: ["GB-ENG"] },
				["2024"],
			),
			code: "lsoaCode",
		},
		name: "lsoaName",
		period: (key) => periods.year(Number(key)),
		measures: [
			HOUSEHOLDS,
			measure(
				"fuel-poor-households",
				"Fuel poor households",
				"households",
				"count",
				"sum",
				"Households in fuel poverty under the Low Income Low Energy Efficiency measure.",
			),
			measure(
				"fuel-poverty-rate",
				"Fuel poverty rate",
				"percent",
				"rate",
				"ratio",
				"Fuel poor households as a percentage of all households.",
				{
					numerator: "fuel-poor-households",
					denominator: "households",
				},
			),
		],
		fields: [
			{ path: "householdCount", measure: "households" },
			{
				path: "fuelPoorHouseholdCount",
				measure: "fuel-poor-households",
			},
			{ path: "fuelPovertyRate", measure: "fuel-poverty-rate" },
		],
		// The rows come straight from the workbook. There is no compiler: the
		// 2024 workbook is keyed by the 2021 LSOAs (it has exactly the 33,755
		// codes of that release, and 1,945 are not in the 2011 one).
		direct: {
			only: true,
			read: async ({ odsTableRows }) => {
				const records = new Map<string, DirectRecord>();
				await odsTableRows(
					FUEL_POVERTY_SOURCE,
					TABLE_OPTIONS,
					([code, name, , , , households, fuelPoor, rate]) => {
						if (!/^E01\d{6}$/.test(code!)) return;
						const numbers = [households, fuelPoor, rate].map(
							Number,
						);
						if (!numbers.every(Number.isFinite)) return;
						records.set(code!, {
							code: code!,
							name,
							values: [
								"households",
								"fuel-poor-households",
								"fuel-poverty-rate",
							].map((measure, index) => ({
								measure,
								value: numbers[index]!,
							})),
						});
					},
				);
				return [{ key: "2024", records: [...records.values()] }];
			},
		},
	},
	ranking: {
		label: "Households in fuel poverty",
		format: { kind: "decimal", digits: 1, suffix: "%" },
	},
	display: {
		label: "Fuel Poverty [2024]",
		year: 2024,
		card: {
			heading: "Fuel Poverty",
			source: "DESNZ. Fuel poverty (LILEE), England, 2024.",
			coverage: "England",
			summariseLsoas: "localAuthority",
		},
		measures: [
			{
				id: "rate",
				label: "Percentage",
				field: "fuelPovertyRate",
				card: {
					unit: "% households",
					digits: 1,
					maximum: 20,
					secondary: {
						field: "fuelPoorHouseholdCount",
						format: { kind: "compact", suffix: " affected" },
					},
				},
				colorRange: { min: 5, max: 15 },
				legend: {
					min: 0,
					max: 30,
					format: {
						kind: "decimal",
						digits: 0,
						suffix: "% households",
					},
				},
			},
			{
				id: "count",
				label: "Total",
				field: "fuelPoorHouseholdCount",
				card: {
					unit: "households",
					maximum: 1000,
					secondary: {
						field: "fuelPovertyRate",
						format: { kind: "decimal", digits: 1, suffix: "%" },
					},
				},
				colorRange: { min: 0, max: 300 },
				legend: {
					min: 0,
					max: 1000,
					format: {
						kind: "count",
						locale: "en-GB",
						suffix: " households",
					},
				},
			},
		],
		aggregation: { scope: "lsoa", aggregate: aggregateFuelPoverty },
	},
});
