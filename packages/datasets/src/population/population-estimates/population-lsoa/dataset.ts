import type { IndicatorDataset } from "../../../types/indicator.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { POPULATION, SEX } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import {
	LSOA_2021_COUNT,
	populationLsoaStatisticsParts,
} from "../../../data/population-small-area/source.ts";

export const populationLsoa = defineDataset<
	IndicatorDataset<"population-lsoa">
>({
	id: "population-lsoa",
	topic: "population-estimates",
	guide: {
		title: "Population (LSOA)",
		about: "How many people live in each small neighbourhood (Lower layer Super Output Area) of England and Wales, every year from 2011. The finest official population count each year, and the base the atlas adds up to put every year of population on every council boundary.",
		summary:
			"Official mid-year population estimates for the 2021 Lower layer Super Output Areas of England and Wales, 2011 to 2024.",
	},
	source: {
		name: "Population (LSOA)",
		publisher: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/lowersuperoutputareamidyearpopulationestimates",
		year: "2011-2024",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Mid-year usual resident population of each 2021 Lower layer Super Output Area in England and Wales, mid-2011 to mid-2024. The total of persons of all ages is held; the workbooks also give single years of age by sex.",
		cadence: "annual",
		notes: [
			"Mid-2022 is published twice. The November 2025 revision, consistent with mid-2023 and mid-2024, is used.",
			"Years before 2021 are the ONS back series on the 2021 LSOAs, not estimates made on the areas of their day.",
		],
	},
	boundary: { type: "lsoa", year: 2021 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
	chartPending: true,
	layout: { regionChunks: { kind: "regional", lsoaToLad: true } },
	ingestion: {
		minimumDatasets: 14,
		minimumDataRecords: LSOA_2021_COUNT,
		expectedBoundaryYears: [2021],
		requiredDataFields: ["value"],
	},
	statistics: {
		direct: {
			only: true,
			read: ({ xlsxSheetSelectedRows }) =>
				populationLsoaStatisticsParts(xlsxSheetSelectedRows),
		},
		payload: {
			parts: yearParts("population-lsoa", "lsoa", 2021, {
				coverageCountries: ["GB-ENG", "GB-WLS"],
			}),
			code: "code",
		},
		name: "name",
		period: (key) => periods.year(Number(key)),
		measures: [POPULATION],
		dimensions: [SEX],
		fields: [
			{ path: "value", measure: "population", members: { sex: "all" } },
		],
	},
});
