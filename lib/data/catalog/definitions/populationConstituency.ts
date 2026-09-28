import {
	loadPopulationConstituencyYear,
	POPULATION_CONSTITUENCY_SHEETS,
} from "../../population-constituency/loader";
import type { PopulationConstituencyDataset } from "@/lib/types/populationConstituency";
import type { DatasetDefinition } from "../types";

const WORKBOOK =
	"demographics/population/small-area-estimates/population-constituency-estimates/sapepconstablefinal.xlsx";

export const populationConstituencyDatasetDefinition: DatasetDefinition<PopulationConstituencyDataset> =
	{
		type: "populationConstituency",
		precompiledFile: "population-constituency",
		boundaryType: "constituency",
		// Published for the API; the website maps constituency population from
		// its ward estimates instead.
		chartPending: true,
		coverageCountries: ["GB-ENG", "GB-WLS"],
		source: {
			name: "Population (Constituency)",
			source: "Office for National Statistics",
			sourceUrl:
				"https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/parliamentaryconstituencymidyearpopulationestimates",
			year: "2021-2022",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"Mid-year usual resident population for Westminster parliamentary constituencies in England and Wales, on the constituencies first contested in July 2024.",
		},
		ingestion: {
			minimumDatasets: 2,
			minimumDataRecords: 575,
			expectedBoundaryYears: [2024],
			requiredDataFields: ["total"],
		},
		precompile: async ({ xlsxSheet }) =>
			Object.fromEntries(
				await Promise.all(
					Object.entries(POPULATION_CONSTITUENCY_SHEETS).map(
						async ([year, sheet]) => [
							year,
							await loadPopulationConstituencyYear(
								Number(year),
								await xlsxSheet(WORKBOOK, sheet),
							),
						],
					),
				),
			),
	};
