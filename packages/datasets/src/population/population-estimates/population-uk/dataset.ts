import type { PopulationUkDataset } from "../../../types/population.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { POPULATION, SEX } from "../../../declaration/measures.ts";
import { AGE, byAge } from "../../../data/population/statistics.ts";
import { populationUkStatisticsParts } from "../../../data/population/ukSource.ts";

export const populationUk = defineDataset<PopulationUkDataset>({
	id: "population-uk",
	topic: "population-estimates",
	boundary: { type: "localAuthority", year: 2023 },
	chartPending: true,
	guide: {
		title: "Population (Local Authority)",
		about: "How many people live in each local authority across the UK, estimated every year by the Office for National Statistics between censuses. It's the standard yardstick for comparing places of different sizes, and many per-person figures in the Atlas are worked out from it.",
		summary:
			"Official population estimates from the Office for National Statistics: every UK local authority each year since 2011. Population density is included too.",
	},
	source: {
		name: "Population (Local Authority)",
		publisher: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/populationestimatesforukenglandandwalesscotlandandnorthernireland",
		year: "2011-2024",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"UK local authority population estimates by single year of age and sex, mid-2011 to mid-2024.",
		cadence: "annual",
		notes: [],
	},
	ingestion: {
		minimumDatasets: 14,
		minimumDataRecords: 361,
		expectedBoundaryYears: [2023],
		requiredDataFields: ["total", "males", "females", "ladName"],
	},
	statistics: {
		direct: {
			only: true,
			read: ({ xlsxSheet }) => populationUkStatisticsParts(xlsxSheet),
		},
		name: "ladName",
		payload: { arrays: ["total", "males", "females"] },
		measures: [POPULATION],
		dimensions: [SEX, AGE],
		fields: byAge,
	},
});
