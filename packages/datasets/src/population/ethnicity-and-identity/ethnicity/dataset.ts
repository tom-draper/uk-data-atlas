import type { EthnicityDataset } from "../../../types/ethnicity.ts";
import {
	defineDataset,
	noCompiledPayload,
} from "../../../declaration/dataset.ts";
import { USUAL_RESIDENTS } from "../../../declaration/measures.ts";
import { type Json } from "../../../declaration/statistics.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import {
	CENSUS_LICENCE,
	census2021,
	districts2021,
} from "../../../data/census/districts.ts";
import { ethnicityStatisticsParts } from "../../../data/ethnicity/source.ts";
import { ETHNICITY_COLORS } from "./colors.ts";

/** The census's ethnic groups, each with the categories it holds, in table order. */
const ETHNIC_GROUPS: Readonly<Record<string, readonly string[]>> = {
	"Asian, Asian British or Asian Welsh": [
		"Bangladeshi",
		"Chinese",
		"Indian",
		"Pakistani",
		"Other Asian",
	],
	"Black, Black British, Black Welsh, Caribbean or African": [
		"African",
		"Caribbean",
		"Other Black",
	],
	"Mixed or Multiple ethnic groups": [
		"White and Asian",
		"White and Black African",
		"White and Black Caribbean",
		"Other Mixed or Multiple ethnic groups",
	],
	White: [
		"English, Welsh, Scottish, Northern Irish or British",
		"Irish",
		"Gypsy or Irish Traveller",
		"Roma",
		"Other White",
	],
	"Other ethnic group": ["Arab", "Any other ethnic group"],
};

/** The census's code for each ethnic category. */
export const ETHNICITY_CODES: Readonly<Record<string, string>> =
	Object.fromEntries(
		Object.values(ETHNIC_GROUPS)
			.flat()
			.map((name, index) => [name, String(index + 1)]),
	);

/**
 * A category's member code in the stored measure: its name as a slug. The
 * numbers in `ETHNICITY_CODES` are the census's own and are not stored.
 */
const memberCodeOf = (name: string) =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

/** Every ethnic category, by its stored member code, in its own colour. */
const ethnicityParts = Object.keys(ETHNICITY_CODES).map((name) => ({
	code: memberCodeOf(name),
	label: name,
	color: ETHNICITY_COLORS[name] ?? "#6b7280",
}));

export const ethnicity = defineDataset<EthnicityDataset>({
	id: "ethnicity",
	topic: "ethnicity-and-identity",
	boundary: { type: "localAuthority", year: 2024 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
	guide: {
		title: "Ethnicity",
		about: "The ethnic groups residents identified with in the 2021 Census, for every local authority in England and Wales. It shows how the make-up of the population differs from place to place.",
		summary:
			"How many residents of each local authority in England and Wales belong to each of the nineteen ethnic groups recorded in Census 2021.",
	},
	mapName: "Ethnicity",
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
	load: noCompiledPayload<EthnicityDataset>(),
	statistics: {
		direct: {
			only: true,
			read: ({ text }) => ethnicityStatisticsParts(text),
		},
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
		dimensions: [
			{
				slug: "ethnic-group",
				label: "Ethnic group",
				members: Object.entries(ETHNIC_GROUPS).flatMap(
					([group, categories]) => [
						{ key: group },
						...categories.map((key) => ({ key, parent: group })),
					],
				),
			},
		],
		fields: [
			{
				path: "{ethnic-group}.{ethnic-group}.population",
				measure: "usual-residents",
			},
		],
	},
	categories: {
		label: "Ethnicity [2021]",
		year: 2021,
		colors: ETHNICITY_COLORS,
		breakdown: {
			measure: "usual-residents",
			dimension: "ethnic-group",
			parts: ethnicityParts,
			order: "largest",
			heading: "Ethnicity",
			period: "2021",
			source: "Office for National Statistics. Census 2021: Ethnic Group, England and Wales. ons.gov.uk",
		},
	},
	ranking: {
		label: "White British residents",
		format: { kind: "decimal", digits: 1, suffix: "%" },
	},
	placeHeadline: {
		places: ["localAuthority"],
		order: 15,
		label: "White British",
		about: "Residents identifying as English, Welsh, Scottish, Northern Irish or British, 2021 Census",
	},
});
