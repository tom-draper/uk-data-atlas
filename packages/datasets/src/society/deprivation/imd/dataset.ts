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
import { parseCsv } from "../../../helpers/parseCsv.ts";
import { parseNum, parseNumInt } from "../../../helpers/parseNumber.ts";
import { sourceDir } from "../../../declaration/sources.ts";
import type { DirectRecord } from "../../../declaration/statistics.ts";
import { yearParts } from "../../../declaration/yearParts.ts";

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

/** The two editions held, each on the LSOAs it was published for. */
const EDITIONS = {
	"2015": {
		file: "File_7_ID_2015_All_ranks__deciles_and_scores_for_the_Indices_of_Deprivation__and_population_denominators.csv",
		lsoa: { code: "LSOA code (2011)", name: "LSOA name (2011)" },
		lad: {
			code: "Local Authority District code (2013)",
			name: "Local Authority District name (2013)",
		},
		population: "Total population: mid 2012 (excluding prisoners)",
		areas: 32844,
		boundaryYear: 2011,
		source: "Ministry of Housing, Communities & Local Government. English Indices of Deprivation 2015.",
	},
	"2025": {
		file: "File_7_IoD2025_All_Ranks_Scores_Deciles_Population_Denominators.csv",
		lsoa: { code: "LSOA code (2021)", name: "LSOA name (2021)" },
		lad: {
			code: "Local Authority District code (2024)",
			name: "Local Authority District name (2024)",
		},
		population: "Total population: mid 2022",
		areas: 33755,
		boundaryYear: 2021,
		source: "Ministry of Housing, Communities & Local Government. English Indices of Deprivation 2025.",
	},
} as const;

type Edition = keyof typeof EDITIONS;

const parseEdition = async (
	text: (path: string) => Promise<string>,
	edition: Edition,
): Promise<DirectRecord[]> => {
	const { file, lsoa, lad, population } = EDITIONS[edition];
	const { data } = await parseCsv(await text(sourceDir("imd", file)), {
		header: true,
	});
	const records = new Map<string, DirectRecord>();
	for (const row of data) {
		const code = row[lsoa.code]?.trim();
		if (!code || !code.startsWith("E")) continue;
		const score = (column: string) => parseNum(row[column]);
		const domain = (member: string, column: string) => ({
			measure: "imd-domain-score",
			members: { "deprivation-domain": member },
			value: score(column),
		});
		records.set(code, {
			code,
			name: row[lsoa.name]?.trim() || "",
			parents: {
				ladCode: {
					code: row[lad.code]?.trim() || "",
					name: row[lad.name]?.trim() || "",
				},
			},
			values: [
				{
					measure: "imd-score",
					value: score("Index of Multiple Deprivation (IMD) Score"),
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
				{ measure: "population", value: parseNumInt(row[population]) },
				domain("incomeScore", "Income Score (rate)"),
				domain("employmentScore", "Employment Score (rate)"),
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
				domain("livingEnvironmentScore", "Living Environment Score"),
			],
		});
	}
	return [...records.values()];
};

export const imd = defineDataset<IMDDataset>({
	id: "imd",
	topic: "deprivation",
	boundary: { type: "lsoa", year: 2021 },
	guide: {
		title: "Indices of Multiple Deprivation",
		about: "The English Indices of Deprivation rank every small neighbourhood in England from most to least deprived, combining income, employment, education, health, crime, housing and living environment. It's the standard way to find the most deprived areas in England. The 2015 and 2025 editions are held; each ranks neighbourhoods against England in its own year.",
		summary:
			"The English Indices of Deprivation, ranking small neighbourhoods from most to least deprived. The legend switches between the overall index and its seven domain scores. Income and employment scores are rates; health and crime scores can be negative. Each domain uses its own scale. Area summaries show population-weighted scores, and domain views do not imply domain deciles. The 2015 edition is on the 2011 neighbourhoods and the 2025 edition on the 2021 neighbourhoods, so a neighbourhood's rank or decile in one year is not comparable with its value in the other.",
	},
	mapName: "Deprivation (IMD)",
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
			"Deprivation scores, ranks and deciles by small area (LSOA) for England: 2015 on 2011 areas and 2025 on 2021 areas.",
		cadence: "irregular",
		notes: [],
	},
	layout: { regionChunks: { kind: "regional", lsoaToLad: true } },
	placeHeadline: {
		places: ["localAuthority"],
		order: 40,
		label: "Deprivation",
		about: "Share of its neighbourhoods in England's most deprived 10%",
	},
	statistics: {
		...base,
		parents: (base.parents ?? []).map((parent) => ({
			...parent,
			// Councils of 2013 that no longer exist are found on the 2015 release.
			alsoIn: [{ geography: "localAuthority", year: 2015 }],
		})),
		payload: {
			...base.payload,
			parts: (labels) =>
				(Object.keys(EDITIONS) as Edition[]).flatMap((key) =>
					yearParts(
						"imd",
						"lsoa",
						EDITIONS[key].boundaryYear,
						{
							metadata: {
								source: EDITIONS[key].source,
								notes: [
									"England only. Decile 1 = most deprived 10% of LSOAs.",
									`Ranks and deciles are relative to the ${EDITIONS[key].areas.toLocaleString("en-GB")} LSOAs of England in ${key} and are not comparable as values with another edition.`,
								],
							},
						},
						[key],
					)(labels),
				),
		},
		direct: {
			only: true,
			read: async ({ text }) =>
				Promise.all(
					(Object.keys(EDITIONS) as Edition[]).map(async (key) => ({
						key,
						records: await parseEdition(text, key),
					})),
				),
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
	catalogue: {
		kind: "indicators",
		yearly: true,
		partial: true,
		checks: ["manifest-areas"],
		coverageNote:
			"England only. The other three nations publish their own indices, which are not comparable with this one.",
		indicators: [
			{
				id: "imd-rank",
				label: "Index of Multiple Deprivation rank",
				field: "imdRank",
				valueKind: "ordinal",
				unit: "rank of {areas} LSOAs, where 1 is the most deprived",
				aggregation: {
					kind: "non-aggregatable",
					statistic: "rank",
					note: "A rank records an order, not a distance: the gap between ranks 1 and 2 need not equal the gap between 100 and 101. Averaging ranks over areas produces a number with no meaning.",
				},
				notes: [
					"A position within England alone. The Welsh, Scottish and Northern Irish indices use different methods, domains and dates, so a rank or decile cannot be compared across nations.",
					"Ranks 1 to 33,755 are served as published for 2025 and ranks 1 to 32,844 for 2015. Each edition ranks its own LSOAs against England in its own year, on the 2021 LSOAs for 2025 and the 2011 LSOAs for 2015, so a rank in one edition is not comparable as a value with a rank in the other.",
				],
				measure: "imd-rank",
			},
			{
				id: "imd-decile",
				label: "Index of Multiple Deprivation decile",
				field: "imdDecile",
				valueKind: "ordinal",
				unit: "decile, where 1 is the most deprived tenth of LSOAs",
				aggregation: {
					kind: "non-aggregatable",
					statistic: "decile",
					note: "A decile is a band of ranks. Averaging deciles over areas produces a number with no meaning, and the share of a place's LSOAs in each decile is the defensible summary instead.",
				},
				notes: [
					"A position within England alone. The Welsh, Scottish and Northern Irish indices use different methods, domains and dates, so a rank or decile cannot be compared across nations.",
					"Deciles divide England's LSOAs into ten near-equal groups by rank: 33,755 LSOAs in 2025 and 32,844 in 2015. A 2015 decile is relative to 2015 England on the 2011 LSOAs, so it is not comparable as a value with a 2025 decile.",
				],
				measure: "imd-decile",
			},
		],
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
