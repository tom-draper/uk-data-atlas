import {
	type DeclaredDataset,
	type Json,
	periods,
} from "../declaredStatistics.ts";
import { yearParts } from "../declaredPayload.ts";
import { USUAL_RESIDENTS } from "./measures.ts";

/** Census 2021 tables. Each breakdown column is a dimension member. */

const census2021 = () => periods.census(2021);

/**
 * The local-authority tables give 2021 districts, plus the unitaries that
 * replaced some of them in 2023, so codes are placed on whichever release
 * holds them.
 */
const districts2021 = {
	release: () => ({ geography: "localAuthority", year: 2021 }),
	alsoIn: [{ geography: "localAuthority", year: 2023 }],
};

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

export const ETHNICITY: DeclaredDataset = {
	type: "ethnicity",
	module: "population",
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
								(entry as { population: number }).population >
								most
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
};
