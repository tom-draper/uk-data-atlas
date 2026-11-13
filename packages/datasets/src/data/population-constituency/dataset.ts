import type { PopulationConstituencyDataset } from "../../types/populationConstituency.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { POPULATION } from "../../declaration/measures.ts";
import {
	loadPopulationConstituencyYear,
	POPULATION_CONSTITUENCY_SHEETS,
} from "./loader.ts";

const WORKBOOK =
	"demographics/population/small-area-estimates/population-constituency-estimates/sapepconstablefinal.xlsx";

export const populationConstituency =
	defineDataset<PopulationConstituencyDataset>({
		id: "population-constituency",
		topic: "population-estimates",
		source: {
			name: "Population (Constituency)",
			publisher: "Office for National Statistics",
			sourceUrl:
				"https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/parliamentaryconstituencymidyearpopulationestimates",
			year: "2021-2022",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			attribution:
				"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
			description:
				"Mid-year usual resident population for Westminster parliamentary constituencies in England and Wales, on the constituencies first contested in July 2024.",
			cadence: "annual",
			notes: [],
		},
		boundary: { type: "constituency", year: 2024 },
		coverageCountries: ["GB-ENG", "GB-WLS"],
		chartPending: true,
		ingestion: {
			minimumDatasets: 2,
			minimumDataRecords: 575,
			expectedBoundaryYears: [2024],
			requiredDataFields: ["total"],
		},
		load: async ({ xlsxSheet }) =>
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
		statistics: {
			payload: {
				header: { coverageCountries: ["GB-ENG", "GB-WLS"] },
				code: "constituencyCode",
			},
			name: "constituencyName",
			measures: [POPULATION],
			fields: [{ path: "total", measure: "population" }],
		},
	});
