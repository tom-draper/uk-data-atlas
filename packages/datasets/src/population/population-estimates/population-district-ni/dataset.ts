import type { PopulationNationDataset } from "../../../types/population.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { POPULATION, SEX } from "../../../declaration/measures.ts";
import { populationDistrictNiStatisticsParts } from "../../../data/population/nationSource.ts";
import {
	AGE,
	byAge,
	POPULATION_TREND,
} from "../../../data/population/statistics.ts";

export const populationDistrictNi = defineDataset<
	PopulationNationDataset<"population-district-ni">
>({
	id: "population-district-ni",
	topic: "population-estimates",
	boundary: { type: "localAuthority", year: 2023 },
	coverageCountries: ["GB-NIR"],
	chartPending: true,
	guide: {
		title: "Population (Northern Ireland districts)",
		about: "How many people live in each local government district of Northern Ireland, by age and sex, every year since 2001, as the Northern Ireland Statistics and Research Agency estimates them. It is the agency's own series, which reaches back ten years before the UK-wide series does.",
		summary:
			"Official mid-year population estimates for Northern Ireland's 11 local government districts by single year of age and sex, 2001 to 2025.",
	},
	source: {
		name: "Population (Northern Ireland districts)",
		publisher: "Northern Ireland Statistics and Research Agency",
		sourceUrl:
			"https://www.nisra.gov.uk/publications/2025-mid-year-population-estimates-northern-ireland-and-estimates-population-aged-85",
		year: "2001-2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Northern Ireland Statistics and Research Agency © Crown copyright. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Northern Ireland's local government district population estimates by single year of age and sex, mid-2001 to mid-2025, on the 2014 district boundaries.",
		cadence: "annual",
		notes: [],
	},
	ingestion: {
		minimumDatasets: 25,
		minimumDataRecords: 11,
		expectedBoundaryYears: [2023],
		requiredDataFields: ["total", "males", "females", "ladName"],
	},
	placeTrend: POPULATION_TREND,
	statistics: {
		direct: {
			only: true,
			read: ({ xlsxSheet }) =>
				populationDistrictNiStatisticsParts(xlsxSheet),
		},
		name: "ladName",
		payload: { arrays: ["total", "males", "females"] },
		measures: [POPULATION],
		dimensions: [SEX, AGE],
		fields: byAge,
	},
});
