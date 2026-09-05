import { loadPopulationUk } from "../../population/ukLoader";
import type { PopulationUkDataset } from "@/lib/types/population";
import type { DatasetDefinition } from "../types";

export const populationUkDatasetDefinition: DatasetDefinition<PopulationUkDataset> =
	{
		type: "populationUk",
		precompiledFile: "population-uk",
		boundaryType: "localAuthority",
		// The ward charts read PopulationDataset, whose aggregation is fixed to
		// ward boundaries, so this series is compiled and validated but not yet
		// rendered.
		chartPending: true,
		source: {
			name: "Population (Local Authority)",
			source: "Office for National Statistics",
			sourceUrl:
				"https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/populationestimatesforukenglandandwalesscotlandandnorthernireland",
			year: "2011-2024",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"UK local authority population estimates by single year of age and sex, mid-2011 to mid-2024.",
		},
		ingestion: {
			minimumDatasets: 14,
			minimumDataRecords: 361,
			expectedBoundaryYears: [2023],
			requiredDataFields: ["total", "males", "females", "ladName"],
		},
		precompile: async ({ xlsxSheet }) => loadPopulationUk(xlsxSheet),
	};
