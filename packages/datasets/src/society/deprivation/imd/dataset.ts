import type { IMDDataset } from "../../../types/imd.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import type { DisplayMeasure } from "../../../declaration/display.ts";
import { summariseIMD } from "../../../helpers/datasetAggregation/deprivation.ts";
import { measure } from "../../../declaration/measures.ts";
import type {
	DeclaredDimension,
	DeclaredField,
} from "../../../declaration/statistics.ts";
import { deprivationStatistics } from "../../../data/deprivation/declaration.ts";
import { loadIMD } from "../../../data/imd/loader.ts";

/** The overall score and its seven domains, each a map measure. */
const SCORES = [
	["imdScore", "Overall IMD", { min: 0, max: 100 }, { min: 1, max: 70 }],
	["incomeScore", "Income deprivation", { min: 0, max: 0.6 }],
	["employmentScore", "Employment deprivation", { min: 0, max: 0.6 }],
	["educationScore", "Education, skills and training", { min: 0, max: 100 }],
	["healthScore", "Health deprivation and disability", { min: -3, max: 3 }],
	["crimeScore", "Crime", { min: -3, max: 3 }],
	["housingScore", "Barriers to housing and services", { min: 0, max: 100 }],
	["livingEnvironmentScore", "Living environment", { min: 0, max: 100 }],
] as const;

/** Income and employment are rates, so they need more places than a score. */
const RATES = new Set(["incomeScore", "employmentScore"]);

const measures = SCORES.map(([id, label, bounds, start]): DisplayMeasure => ({
	id,
	label,
	field: id,
	colorRange: { ...(start ?? bounds) },
	legend: {
		...bounds,
		format: { kind: "decimal", digits: RATES.has(id) ? 3 : 1 },
	},
})) as [DisplayMeasure, ...DisplayMeasure[]];

const DOMAINS: DeclaredDimension = {
	slug: "deprivation-domain",
	label: "Deprivation domain",
	members: [
		{ key: "incomeScore", code: "income", label: "Income" },
		{ key: "employmentScore", code: "employment", label: "Employment" },
		{
			key: "educationScore",
			code: "education",
			label: "Education, skills and training",
		},
		{
			key: "healthScore",
			code: "health",
			label: "Health deprivation and disability",
		},
		{ key: "crimeScore", code: "crime", label: "Crime" },
		{
			key: "housingScore",
			code: "housing",
			label: "Barriers to housing and services",
		},
		{
			key: "livingEnvironmentScore",
			code: "living-environment",
			label: "Living environment",
		},
	],
};

const base = deprivationStatistics({
	id: "imd",
	prefix: "imd",
	index: "Index of Multiple Deprivation",
	area: "LSOAs in England",
	fields: { score: true, decile: true, population: true },
	boundary: { type: "lsoa", year: 2021 },
	edition: "2025",
	metadata: {
		source: "Ministry of Housing, Communities & Local Government. English Indices of Deprivation 2025.",
		notes: ["England only. Decile 1 = most deprived 10% of LSOAs."],
	},
	code: "lsoaCode",
	name: "lsoaName",
	parent: { code: "ladCode", name: "ladName" },
	summaryField: "ladStats",
	mostDeprived: (record) => record.imdDecile === 1,
	weighted: {
		score: "imdScore",
		domains: [
			"incomeScore",
			"employmentScore",
			"educationScore",
			"healthScore",
			"crimeScore",
			"housingScore",
			"livingEnvironmentScore",
		],
	},
});

export const imd = defineDataset<IMDDataset>({
	id: "imd",
	topic: "deprivation",
	boundary: { type: "lsoa", year: 2021 },
	source: {
		name: "Indices of Multiple Deprivation",
		publisher: "Ministry of Housing, Communities & Local Government",
		sourceUrl:
			"https://www.gov.uk/government/statistics/english-indices-of-deprivation-2025",
		year: "2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Ministry of Housing, Communities & Local Government. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Deprivation scores, ranks and deciles by 2021 small area (LSOA) for England.",
		cadence: "irregular",
		notes: [],
	},
	layout: { regionChunks: { kind: "regional", lsoaToLad: true } },
	load: ({ text }) => loadIMD(text),
	statistics: {
		...base,
		measures: [
			...base.measures,
			measure(
				"imd-domain-score",
				"Index of Multiple Deprivation domain score",
				"score",
				"index",
				"none",
				"Score for one domain of the English Index of Multiple Deprivation; income and employment are rates.",
			),
		],
		dimensions: [DOMAINS],
		fields: [
			...(base.fields as DeclaredField[]),
			{ path: "{deprivation-domain}", measure: "imd-domain-score" },
		],
	},
	display: {
		label: "Deprivation (IMD) [2025]",
		year: 2025,
		component: "@/components/datasets/society/deprivation/imd/IMDChart",
		measures,
		aggregation: {
			scope: "lsoa",
			distinct: true,
			aggregate: summariseIMD,
		},
	},
});
