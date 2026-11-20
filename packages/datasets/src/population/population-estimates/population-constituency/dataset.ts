import type { PopulationConstituencyDataset } from "../../../types/populationConstituency.ts";
import {
	defineDataset,
	noCompiledPayload,
} from "../../../declaration/dataset.ts";
import { POPULATION, SEX } from "../../../declaration/measures.ts";
import { AGE, byAge } from "../../../data/population/statistics.ts";
import { populationConstituencyStatisticsParts } from "../../../data/population-constituency/source.ts";

export const populationConstituency =
	defineDataset<PopulationConstituencyDataset>({
		id: "population-constituency",
		topic: "population-estimates",
		guide: {
			title: "Population (Constituency)",
			about: "How many people live in each Westminster constituency in England and Wales, on the boundaries used from the 2024 general election onwards. Useful for putting election results and other constituency figures in context.",
			summary:
				"Official population estimates for the Westminster constituencies first contested in 2024.",
		},
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
				"Mid-year usual resident population for Westminster parliamentary constituencies in England and Wales, on the constituencies first contested in July 2024, with the total and single years of age by sex.",
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
			requiredDataFields: ["allAges", "total", "males", "females"],
		},
		load: noCompiledPayload<PopulationConstituencyDataset>(),
		statistics: {
			direct: {
				only: true,
				read: ({ xlsxSheet }) =>
					populationConstituencyStatisticsParts(xlsxSheet),
			},
			payload: {
				header: { coverageCountries: ["GB-ENG", "GB-WLS"] },
				code: "constituencyCode",
				arrays: ["total", "males", "females"],
			},
			name: "constituencyName",
			measures: [POPULATION],
			dimensions: [SEX, AGE],
			fields: [{ path: "allAges", measure: "population" }, ...byAge],
		},
	});
