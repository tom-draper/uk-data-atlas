import type { PopulationUkDataset } from "../../types/population.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { POPULATION, SEX } from "../../declaration/measures.ts";
import { AGE, byAge } from "../population/statistics.ts";
import { loadPopulationUk } from "../population/ukLoader.ts";

export const populationUk = defineDataset<PopulationUkDataset>({
	id: "population-uk",
	module: "population",
	boundary: { type: "localAuthority", year: 2023 },
	chartPending: true,
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
	load: async ({ xlsxSheet }) => loadPopulationUk(xlsxSheet),
	statistics: {
		name: "ladName",
		payload: { arrays: ["total", "males", "females"] },
		measures: [POPULATION],
		dimensions: [SEX, AGE],
		fields: byAge,
	},
});
