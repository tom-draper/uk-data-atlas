import type { PopulationDataset } from "../../../types/population.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { POPULATION, SEX } from "../../../declaration/measures.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { CENSUS_LICENCE } from "../../../data/census/districts.ts";
import { loadPopulation } from "../../../data/population/loader.ts";
import { AGE, byAge } from "../../../data/population/statistics.ts";

export const population = defineDataset<PopulationDataset>({
	id: "population",
	topic: "population-estimates",
	boundary: { type: "ward", year: 2023 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
	layout: {
		regionChunks: {
			kind: "regional",
			populationSummary: true,
			locationAggregate: "population",
		},
	},
	source: {
		name: "Population",
		publisher: "Office for National Statistics",
		sourceUrl: "https://www.ons.gov.uk/",
		year: "2022",
		...CENSUS_LICENCE,
		description:
			"Ward population estimates for mid-2022. Newer ONS ward estimates use May 2025 boundaries, which are not yet mapped in the atlas.",
		cadence: "annual",
		notes: [],
	},
	load: ({ xlsxSheetRows }) => loadPopulation(xlsxSheetRows),
	statistics: {
		payload: {
			parts: yearParts("population", "ward", 2023, {
				coverageCountries: ["GB-ENG", "GB-WLS"],
			}),
			arrays: ["total", "males", "females"],
		},
		name: "wardName",
		parents: [
			{
				code: "ladCode",
				name: "ladName",
				release: { geography: "localAuthority", year: 2023 },
			},
		],
		measures: [POPULATION],
		dimensions: [SEX, AGE],
		fields: byAge,
	},
});
