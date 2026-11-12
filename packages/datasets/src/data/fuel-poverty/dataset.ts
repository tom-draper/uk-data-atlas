import type { FuelPovertyDataset } from "../../types/fuelPoverty.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { HOUSEHOLDS, measure } from "../../declaration/measures.ts";
import { periods } from "../../declaration/statistics.ts";
import { yearParts } from "../../declaration/yearParts.ts";
import { loadFuelPoverty } from "./loader.ts";

export const fuelPoverty = defineDataset<FuelPovertyDataset>({
	id: "fuel-poverty",
	module: "deprivation",
	boundary: { type: "lsoa", year: 2021 },
	coverageCountries: ["GB-ENG"],
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
	load: ({ odsTableRows }) => loadFuelPoverty(odsTableRows),
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
	},
});
