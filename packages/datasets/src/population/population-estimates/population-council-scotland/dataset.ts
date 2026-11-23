import type { PopulationNationDataset } from "../../../types/population.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { POPULATION, SEX } from "../../../declaration/measures.ts";
import { populationCouncilScotlandStatisticsParts } from "../../../data/population/nationSource.ts";
import { AGE, byAge } from "../../../data/population/statistics.ts";

export const populationCouncilScotland = defineDataset<
	PopulationNationDataset<"population-council-scotland">
>({
	id: "population-council-scotland",
	topic: "population-estimates",
	boundary: { type: "localAuthority", year: 2023 },
	coverageCountries: ["GB-SCT"],
	chartPending: true,
	guide: {
		title: "Population (Scottish council areas)",
		about: "How many people live in each council area of Scotland, by age and sex, every year since 1981, as National Records of Scotland estimates them. It is the publisher's own series, which carries the latest revisions and reaches back thirty years before the UK-wide series does.",
		summary:
			"Official mid-year population estimates for Scotland's council areas by single year of age and sex, 1981 to 2025.",
	},
	source: {
		name: "Population (Scottish council areas)",
		publisher: "National Records of Scotland",
		sourceUrl:
			"https://www.nrscotland.gov.uk/publications/population-estimates-time-series-data/",
		year: "1981-2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"National Records of Scotland © Crown copyright. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Scotland's council area population estimates by single year of age and sex, mid-1981 to mid-2025, as the mid-2025 time series publishes them.",
		cadence: "annual",
		notes: [
			"Mid-2023 and mid-2024 are revised for updated long-term international migration, so they differ from the UK-wide series, which has not taken the revision.",
			"Years to 2001 are on the 1995 council areas and 2002 to 2017 on the 2011 council areas. Fife and Perth and Kinross changed in 2018 and Glasgow City and North Lanarkshire in 2019, each by a very minor boundary change that did not move the population. Every year is filed here under the area's current code.",
		],
	},
	ingestion: {
		minimumDatasets: 45,
		minimumDataRecords: 32,
		expectedBoundaryYears: [2023],
		requiredDataFields: ["total", "males", "females", "ladName"],
	},
	statistics: {
		direct: {
			only: true,
			read: ({ xlsxSheet }) =>
				populationCouncilScotlandStatisticsParts(xlsxSheet),
		},
		name: "ladName",
		payload: { arrays: ["total", "males", "females"] },
		measures: [POPULATION],
		dimensions: [SEX, AGE],
		fields: byAge,
	},
});
