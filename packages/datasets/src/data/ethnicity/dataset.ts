import type { EthnicityDataset } from "../../types/ethnicity.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { USUAL_RESIDENTS } from "../../declaration/measures.ts";
import { type Json } from "../../declaration/statistics.ts";
import { yearParts } from "../../declaration/yearParts.ts";
import {
	CENSUS_LICENCE,
	census2021,
	districts2021,
} from "../census/districts.ts";
import { loadEthnicity } from "./loader.ts";

/** The census's code for each ethnic group. */
const ETHNICITY_CODES: Readonly<Record<string, string>> = Object.fromEntries(
	[
		"Bangladeshi",
		"Chinese",
		"Indian",
		"Pakistani",
		"Other Asian",
		"African",
		"Caribbean",
		"Other Black",
		"White and Asian",
		"White and Black African",
		"White and Black Caribbean",
		"Other Mixed or Multiple ethnic groups",
		"English, Welsh, Scottish, Northern Irish or British",
		"Irish",
		"Gypsy or Irish Traveller",
		"Roma",
		"Other White",
		"Arab",
		"Any other ethnic group",
	].map((name, index) => [name, String(index + 1)]),
);

export const ethnicity = defineDataset<EthnicityDataset>({
	id: "ethnicity",
	topic: "ethnicity-and-identity",
	boundary: { type: "localAuthority", year: 2024 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
	source: {
		name: "Ethnicity",
		publisher: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/datasets/TS021/editions/2021/versions/3",
		year: "2021",
		...CENSUS_LICENCE,
		description: "Census ethnicity estimates by local authority.",
		cadence: "decennial",
		notes: [],
		retrievedAt: "2026-09-05",
	},
	load: async ({ text }) => loadEthnicity(text),
	statistics: {
		payload: {
			parts: yearParts(
				"ethnicity",
				"localAuthority",
				2024,
				{ coverageCountries: ["GB-ENG", "GB-WLS"] },
				["2021"],
			),
			/** Each group's entries carry their label and the census's code. */
			fill: (record) => {
				for (const group of Object.values(record))
					for (const [name, entry] of Object.entries(
						group as Record<string, Record<string, Json>>,
					)) {
						entry.ethnicity = name;
						entry.code = ETHNICITY_CODES[name];
					}
			},
			/** The largest group in each area. */
			summary: (records) => ({
				results: Object.fromEntries(
					Object.entries(records).map(([code, record]) => {
						let largest = "";
						let most = -1;
						for (const group of Object.values(
							record as Record<string, Record<string, Json>>,
						))
							for (const [name, entry] of Object.entries(group))
								if (
									(entry as { population: number })
										.population > most
								) {
									most = (entry as { population: number })
										.population;
									largest = name;
								}
						return [code, largest];
					}),
				),
			}),
		},
		...districts2021,
		period: census2021,
		measures: [USUAL_RESIDENTS],
		dimensions: [{ slug: "ethnic-group", label: "Ethnic group" }],
		fields: [
			{
				path: "{ethnic-group}.{ethnic-group}.population",
				measure: "usual-residents",
			},
		],
	},
});
