import type { PopulationDataset } from "../../../types/population.ts";
import {
	defineDataset,
	noCompiledPayload,
} from "../../../declaration/dataset.ts";
import { POPULATION, SEX } from "../../../declaration/measures.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { CENSUS_LICENCE } from "../../../data/census/districts.ts";
import { populationStatisticsParts } from "../../../data/population/source.ts";
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
	guide: {
		title: "Population",
		about: "Population estimates for the much smaller electoral wards of England and Wales, broken down by age and sex. The Atlas uses it for its population density, age and gender maps, which show how people are spread within a council area rather than across the country.",
		summary:
			"Official population estimates for wards in England and Wales, through mid-2022. Newer ONS ward estimates, on May 2025 boundaries, are not in the Atlas yet. Population density is included too.",
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
	load: noCompiledPayload<PopulationDataset>(),
	mapViews: [
		{
			id: "density",
			name: "Population Density",
			ranking: {
				label: "Residents per km²",
				format: {
					kind: "count",
					locale: "en-GB",
					round: true,
					suffix: " per km²",
				},
			},
			value: { computed: "total", perSquareKm: true },
			optionsKey: "populationDensity",
			colorRange: { min: 0, max: 8000 },
			legend: {
				min: 0,
				max: 15000,
			},
		},
		{
			id: "age",
			name: "Age Distribution",
			ranking: {
				label: "Median age",
				format: { kind: "decimal", digits: 1, suffix: " years" },
			},
			value: { computed: "medianAge" },
			optionsKey: "ageDistribution",
			colorRange: { min: 25, max: 65 },
			legend: {
				min: 18,
				max: 80,
			},
		},
		{
			id: "gender",
			name: "Gender Balance",
			value: { computed: "genderBalance" },
			optionsKey: "gender",
			colorRange: { min: -0.1, max: 0.1 },
			legend: {
				min: -0.5,
				max: 0.5,
			},
			palette: "gender",
		},
	],
	statistics: {
		direct: {
			only: true,
			read: ({ xlsxSheetRows }) =>
				populationStatisticsParts(xlsxSheetRows),
		},
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
