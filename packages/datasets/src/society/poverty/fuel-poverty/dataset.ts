import type { FuelPovertyDataset } from "../../../types/fuelPoverty.ts";
import {
	defineDataset,
	noCompiledPayload,
} from "../../../declaration/dataset.ts";
import { HOUSEHOLDS, measure } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
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
	load: noCompiledPayload<FuelPovertyDataset>(),
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
});
