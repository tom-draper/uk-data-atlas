import type { IMDDataset } from "../../../types/imd.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import type { DisplayMeasure } from "../../../declaration/display.ts";
import { summariseIMD } from "../../../helpers/datasetAggregation/deprivation.ts";
import { measure } from "../../../declaration/measures.ts";
import type {
	DeclaredDimension,
	DeclaredField,
} from "../../../declaration/statistics.ts";
import {
	DEPRIVATION_CHART_COMPONENT,
	deprivationStatistics,
} from "../../../data/deprivation/declaration.ts";
import { loadIMD } from "../../../data/imd/loader.ts";
import { parseCsv } from "../../../helpers/parseCsv.ts";
import { parseNum, parseNumInt } from "../../../helpers/parseNumber.ts";
import { sourceDir } from "../../../declaration/sources.ts";
import type { DirectRecord } from "../../../declaration/statistics.ts";

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
	placeHeadline: {
		places: ["localAuthority"],
		order: 40,
		label: "Deprivation",
		about: "Share of its neighbourhoods in England's most deprived 10%",
	},
	statistics: {
		...base,
		direct: {
			read: async ({ text }) => {
				const csv = await text(
					sourceDir(
						"imd",
						"File_7_IoD2025_All_Ranks_Scores_Deciles_Population_Denominators.csv",
					),
				);
				const { data } = await parseCsv(csv, { header: true });
				const records = new Map<string, DirectRecord>();
				for (const row of data) {
					const code = row["LSOA code (2021)"]?.trim();
					if (!code || !code.startsWith("E")) continue;
					const score = (column: string) => parseNum(row[column]);
					const domain = (member: string, column: string) => ({
						measure: "imd-domain-score",
						members: { "deprivation-domain": member },
						value: score(column),
					});
					records.set(code, {
						code,
						name: row["LSOA name (2021)"]?.trim() || "",
						parents: {
							ladCode: {
								code:
									row[
										"Local Authority District code (2024)"
									]?.trim() || "",
								name:
									row[
										"Local Authority District name (2024)"
									]?.trim() || "",
							},
						},
						values: [
							{
								measure: "imd-score",
								value: score(
									"Index of Multiple Deprivation (IMD) Score",
								),
							},
							{
								measure: "imd-rank",
								value: parseNumInt(
									row[
										"Index of Multiple Deprivation (IMD) Rank (where 1 is most deprived)"
									],
								),
							},
							{
								measure: "imd-decile",
								value: parseNumInt(
									row[
										"Index of Multiple Deprivation (IMD) Decile (where 1 is most deprived 10% of LSOAs)"
									],
								),
							},
							{
								measure: "population",
								value: parseNumInt(
									row["Total population: mid 2022"],
								),
							},
							domain("incomeScore", "Income Score (rate)"),
							domain(
								"employmentScore",
								"Employment Score (rate)",
							),
							domain(
								"educationScore",
								"Education, Skills and Training Score",
							),
							domain(
								"healthScore",
								"Health Deprivation and Disability Score",
							),
							domain("crimeScore", "Crime Score"),
							domain(
								"housingScore",
								"Barriers to Housing and Services Score",
							),
							domain(
								"livingEnvironmentScore",
								"Living Environment Score",
							),
						],
					});
				}
				return [{ key: "2025", records: [...records.values()] }];
			},
		},
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
	ranking: {
		label: "Neighbourhoods in England's most deprived 10%",
		format: { kind: "decimal", digits: 1, suffix: "%" },
	},
	display: {
		label: "Deprivation (IMD) [2025]",
		year: 2025,
		component: DEPRIVATION_CHART_COMPONENT,
		deprivation: {
			label: "IMD",
			region: "England",
			attribution:
				"Ministry of Housing, Communities & Local Government. English Indices of Deprivation 2025. gov.uk",
			metric: "score",
			metricMaximum: 92.735,
			areaNoun: "LSOAs",
			areaType: "lsoa",
			summaryField: "ladStats",
			metricField: "imdScore",
			decileField: "imdDecile",
			domains: {
				attribution: "MHCLG. English Indices of Deprivation 2025.",
			},
		},
		measures,
		aggregation: {
			scope: "lsoa",
			distinct: true,
			aggregate: summariseIMD,
		},
	},
});
