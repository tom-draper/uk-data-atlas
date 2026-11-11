import {
	type DeclaredDataset,
	type DeclaredDimension,
	type DeclaredField,
	type DeclaredParent,
	type DeclaredPayload,
	type Json,
	type DeclaredHeader,
	periods,
} from "../declaredStatistics.ts";
import { yearParts } from "../declaredPayload.ts";
import {
	ELECTORATE,
	LIFE_EXPECTANCY,
	POPULATION,
	REJECTED_BALLOTS,
	SEX,
	TURNOUT,
	VALID_VOTES,
	measure,
} from "./measures.ts";

/** Population, life expectancy, deprivation and the EU referendum. */

/** Single years of age, with 90 meaning 90 and over. */
const AGE: DeclaredDimension = {
	slug: "age",
	label: "Age",
	members: Array.from({ length: 91 }, (_, age) => ({
		key: String(age),
		code: age === 90 ? "90-plus" : String(age),
		label: age === 90 ? "Aged 90 and over" : `Aged ${age}`,
	})),
};

const byAge = [
	{ path: "total.{age}", measure: "population", members: { sex: "all" } },
	{ path: "males.{age}", measure: "population", members: { sex: "male" } },
	{
		path: "females.{age}",
		measure: "population",
		members: { sex: "female" },
	},
];

export const POPULATION_WARDS: DeclaredDataset = {
	type: "population",
	module: "population",
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
};

export const POPULATION_UK: DeclaredDataset = {
	type: "populationUk",
	module: "population",
	name: "ladName",
	payload: {
		parts: yearParts("populationUk", "localAuthority", 2023),
		arrays: ["total", "males", "females"],
	},
	measures: [POPULATION],
	dimensions: [SEX, AGE],
	fields: byAge,
};

export const POPULATION_CONSTITUENCY: DeclaredDataset = {
	type: "populationConstituency",
	module: "population",
	name: "constituencyName",
	payload: {
		parts: yearParts("populationConstituency", "constituency", 2024, {
			coverageCountries: ["GB-ENG", "GB-WLS"],
		}),
		code: "constituencyCode",
	},
	measures: [POPULATION],
	fields: [{ path: "total", measure: "population" }],
};

/** `2022-2024`, with a hyphen or an en dash. */
const yearRange = (text: unknown) => {
	const match = /^(\d{4})[-–](\d{4})$/.exec(String(text));
	if (!match) throw new Error(`Unknown year range ${String(text)}`);
	return periods.years(Number(match[1]), Number(match[2]));
};

const HEALTHY_LIFE_EXPECTANCY = measure(
	"healthy-life-expectancy",
	"Healthy life expectancy at birth",
	"years",
	"mean",
	"none",
	"Average years a newborn would live in very good or good health at the period's rates.",
);

export const LIFE_EXPECTANCY_LATEST: DeclaredDataset = {
	type: "lifeExpectancy",
	module: "health",
	payload: {
		parts: () => [
			{
				key: "le",
				header: {
					id: "le",
					year: 2024,
					type: "lifeExpectancy",
					boundaryType: "localAuthority",
					boundaryYear: 2023,
					dataPeriod: "2022–2024",
					label: "Life Expectancy",
					coverageCountries: ["GB-ENG", "GB-SCT", "GB-WLS", "GB-NIR"],
					metadata: {
						source: "Office for National Statistics. Life expectancy for local areas of the UK: 2022 to 2024.",
						notes: [
							"Life expectancy at birth. UK local authorities.",
						],
					},
				},
			},
			{
				key: "hle",
				header: {
					id: "hle",
					year: 2024,
					type: "lifeExpectancy",
					boundaryType: "localAuthority",
					boundaryYear: 2023,
					dataPeriod: "2022–2024",
					label: "Healthy Life Expectancy",
					coverageCountries: ["GB-ENG", "GB-SCT", "GB-WLS", "GB-NIR"],
					metadata: {
						source: "Office for National Statistics. Healthy life expectancy, UK: 2022 to 2024.",
						notes: [
							"Healthy life expectancy at birth. UK local authorities.",
						],
					},
				},
			},
		],
		code: "ladCode",
	},
	name: "ladName",
	period: (_key, header) => yearRange(header.dataPeriod),
	alsoIn: [
		{ geography: "countyAndUnitaryAuthority", year: 2025 },
		{ geography: "region", year: 2025 },
		{ geography: "country", year: 2023 },
		{ geography: "localAuthority", year: 2022 },
	],
	measures: [LIFE_EXPECTANCY, HEALTHY_LIFE_EXPECTANCY],
	dimensions: [SEX],
	fields: (key) => {
		const slug = { le: "life-expectancy", hle: "healthy-life-expectancy" }[
			key
		];
		if (!slug) throw new Error(`Unknown life expectancy table ${key}`);
		return [
			{ path: "maleBirthLE", measure: slug, members: { sex: "male" } },
			{
				path: "femaleBirthLE",
				measure: slug,
				members: { sex: "female" },
			},
		];
	},
};

const deprivation = (
	type: string,
	prefix: string,
	index: string,
	area: string,
	fields: {
		score?: boolean;
		quintile?: boolean;
		decile?: boolean;
		population?: boolean;
	},
): DeclaredDataset & { fields: DeclaredField[] } => ({
	type,
	module: "deprivation",
	measures: [
		...(fields.score
			? [
					measure(
						`${prefix}-score`,
						`${index} score`,
						"score",
						"index",
						"none",
						`${index} score; higher is more deprived.`,
					),
				]
			: []),
		measure(
			`${prefix}-rank`,
			`${index} rank`,
			"rank",
			"rank",
			"none",
			`Rank of ${area} by the ${index}, where 1 is the most deprived.`,
		),
		...(fields.quintile
			? [
					measure(
						`${prefix}-quintile`,
						`${index} quintile`,
						"quintile",
						"index",
						"none",
						`Fifth of ${area} by the ${index}, where 1 is the most deprived.`,
					),
				]
			: []),
		...(fields.decile
			? [
					measure(
						`${prefix}-decile`,
						`${index} decile`,
						"decile",
						"index",
						"none",
						`Tenth of ${area} by the ${index}, where 1 is the most deprived.`,
					),
				]
			: []),
		...(fields.population ? [POPULATION] : []),
	],
	fields: [
		...(fields.score
			? [{ path: `${prefix}Score`, measure: `${prefix}-score` }]
			: []),
		{ path: `${prefix}Rank`, measure: `${prefix}-rank` },
		...(fields.quintile
			? [{ path: `${prefix}Quintile`, measure: `${prefix}-quintile` }]
			: []),
		...(fields.decile
			? [{ path: `${prefix}Decile`, measure: `${prefix}-decile` }]
			: []),
		...(fields.population
			? [{ path: "population", measure: "population" }]
			: []),
	],
});

type Rows = Record<string, Json>[];

/**
 * The payload of a deprivation index: its one part, with a summary of the
 * areas inside each area its records name as their parent, computed from the
 * records. `population` and `weighted` make the summary population weighted.
 */
const deprivationPayload = (options: {
	type: string;
	key: string;
	boundaryType: string;
	boundaryYear: number;
	metadata: { source: string; notes: string[] };
	code: string;
	parent: string;
	summaryField: string;
	/** Whether a record is among the most deprived. */
	mostDeprived: (record: Record<string, Json>) => boolean;
	/** The record fields to average by population, `score` first. */
	weighted?: { score: string; domains?: string[] };
}): DeclaredPayload => ({
	parts: () => [
		{
			key: options.key,
			header: {
				id: `${options.type}${options.key}`,
				year: Number(options.key),
				type: options.type,
				boundaryType: options.boundaryType,
				boundaryYear: options.boundaryYear,
				metadata: options.metadata,
			},
		},
	],
	code: options.code,
	summary: (records) => {
		const groups = new Map<string, Rows>();
		for (const found of Object.values(records)) {
			const record = found as Record<string, Json>;
			const parent = String(record[options.parent]);
			const rows = groups.get(parent) ?? [];
			rows.push(record);
			groups.set(parent, rows);
		}
		const weighted = options.weighted;
		const average = (rows: Rows, field: string, population: number) =>
			rows.reduce(
				(sum, row) =>
					sum + (row[field] as number) * (row.population as number),
				0,
			) / population;
		return {
			[options.summaryField]: Object.fromEntries(
				[...groups].map(([parent, rows]) => {
					const population = weighted
						? rows.reduce(
								(sum, row) => sum + (row.population as number),
								0,
							)
						: 0;
					return [
						parent,
						{
							areaCount: rows.length,
							mostDeprivedCount: rows.filter(options.mostDeprived)
								.length,
							...(weighted
								? {
										population,
										averageScore: average(
											rows,
											weighted.score,
											population,
										),
									}
								: {}),
							...(weighted?.domains
								? {
										domainScores: Object.fromEntries(
											weighted.domains.map((field) => [
												field,
												average(
													rows,
													field,
													population,
												),
											]),
										),
									}
								: {}),
						},
					];
				}),
			),
		};
	},
});

const IMD_DOMAINS: DeclaredDimension = {
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

const imd = deprivation(
	"imd",
	"imd",
	"Index of Multiple Deprivation",
	"LSOAs in England",
	{ score: true, decile: true, population: true },
);
const districtParent = (code: string, name: string): DeclaredParent[] => [
	{ code, name, release: { geography: "localAuthority", year: 2024 } },
];

export const IMD: DeclaredDataset = {
	...imd,
	payload: deprivationPayload({
		type: "imd",
		key: "2025",
		boundaryType: "lsoa",
		boundaryYear: 2021,
		metadata: {
			source: "Ministry of Housing, Communities & Local Government. English Indices of Deprivation 2025.",
			notes: ["England only. Decile 1 = most deprived 10% of LSOAs."],
		},
		code: "lsoaCode",
		parent: "ladCode",
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
	}),
	name: "lsoaName",
	parents: districtParent("ladCode", "ladName"),
	measures: [
		...imd.measures,
		measure(
			"imd-domain-score",
			"Index of Multiple Deprivation domain score",
			"score",
			"index",
			"none",
			"Score for one domain of the English Index of Multiple Deprivation; income and employment are rates.",
		),
	],
	dimensions: [IMD_DOMAINS],
	fields: [
		...imd.fields,
		{ path: "{deprivation-domain}", measure: "imd-domain-score" },
	],
};

export const WIMD: DeclaredDataset = {
	...deprivation(
		"wimd",
		"wimd",
		"Welsh Index of Multiple Deprivation",
		"LSOAs in Wales",
		{ score: true, decile: true, population: true },
	),
	payload: deprivationPayload({
		type: "wimd",
		key: "2019",
		boundaryType: "lsoa",
		boundaryYear: 2011,
		metadata: {
			source: "Welsh Government. Welsh Index of Multiple Deprivation 2019.",
			notes: ["Wales only. Decile 1 = most deprived 10% of LSOAs."],
		},
		code: "lsoaCode",
		parent: "ladCode",
		summaryField: "ladStats",
		mostDeprived: (record) => record.wimdDecile === 1,
		weighted: { score: "wimdScore" },
	}),
	name: "lsoaName",
	parents: districtParent("ladCode", "ladName"),
};

export const SIMD: DeclaredDataset = {
	...deprivation(
		"simd",
		"simd",
		"Scottish Index of Multiple Deprivation",
		"data zones in Scotland",
		{ quintile: true, decile: true },
	),
	payload: deprivationPayload({
		type: "simd",
		key: "2020",
		boundaryType: "dataZone",
		boundaryYear: 2011,
		metadata: {
			source: "Scottish Government. Scottish Index of Multiple Deprivation 2020v2.",
			notes: [
				"Scotland only. Quintile 1 = most deprived 20% of data zones.",
			],
		},
		code: "dzCode",
		parent: "councilAreaCode",
		summaryField: "councilStats",
		mostDeprived: (record) => record.simdDecile === 1,
	}),
	name: "dzName",
	parents: districtParent("councilAreaCode", "councilAreaName"),
};

export const NIMDM: DeclaredDataset = {
	...deprivation(
		"nimdm",
		"nimdm",
		"Northern Ireland Multiple Deprivation Measure",
		"super output areas in Northern Ireland",
		{},
	),
	payload: deprivationPayload({
		type: "nimdm",
		key: "2017",
		boundaryType: "superOutputArea",
		boundaryYear: 2011,
		metadata: {
			source: "Northern Ireland Statistics and Research Agency. Northern Ireland Multiple Deprivation Measure 2017.",
			notes: [
				"Northern Ireland only. NISRA publishes ranks, not deciles, for Super Output Areas; rank 1 is the most deprived.",
			],
		},
		code: "soaCode",
		parent: "lgdCode",
		summaryField: "lgdStats",
		/** The most deprived tenth of the 890 areas. */
		mostDeprived: (record) => (record.nimdmRank as number) <= 89,
	}),
	name: "soaName",
	parents: districtParent("lgdCode", "lgdName"),
};

const REFERENDUM = [
	ELECTORATE,
	VALID_VOTES,
	REJECTED_BALLOTS,
	measure(
		"referendum-votes",
		"Referendum votes",
		"votes",
		"count",
		"sum",
		"Valid votes cast for an answer.",
	),
	measure(
		"referendum-vote-share",
		"Referendum vote share",
		"percent",
		"share",
		"ratio",
		"Votes for an answer as a percentage of valid votes.",
		{ numerator: "referendum-votes", denominator: "valid-votes" },
	),
	TURNOUT,
];
const ANSWER: DeclaredDimension = {
	slug: "referendum-answer",
	label: "Referendum answer",
	members: [
		{ key: "remain", label: "Remain a member of the European Union" },
		{ key: "leave", label: "Leave the European Union" },
	],
};
const referendumDay = () => periods.date("2016-06-23");

export const BREXIT: DeclaredDataset = {
	type: "brexit",
	module: "politics",
	payload: {
		parts: yearParts("brexit", "localAuthority", 2016, {}, ["2016"]),
		code: "ladCode",
		/** The answer with more votes in each area. */
		summary: (records) => ({
			results: Object.fromEntries(
				Object.entries(records).map(([code, record]) => {
					const { leave, remain } = record as {
						leave: number;
						remain: number;
					};
					return [
						code,
						leave > remain
							? "leave"
							: remain > leave
								? "remain"
								: null,
					];
				}),
			),
		}),
	},
	name: "ladName",
	parents: [
		{
			code: "regionCode",
			name: "regionName",
			release: { geography: "region", year: 2025 },
			alsoIn: [{ geography: "country", year: 2025 }],
		},
	],
	period: referendumDay,
	alsoIn: [{ geography: "country", year: 2020 }],
	measures: REFERENDUM,
	dimensions: [ANSWER],
	fields: [
		{ path: "electorate", measure: "electorate" },
		{ path: "validVotes", measure: "valid-votes" },
		{ path: "rejectedBallots", measure: "rejected-ballots" },
		{ path: "pctTurnout", measure: "turnout" },
		...(["remain", "leave"] as const).flatMap((answer) => [
			{
				path: answer,
				measure: "referendum-votes",
				members: { "referendum-answer": answer },
			},
			{
				path: `pct${answer[0].toUpperCase()}${answer.slice(1)}`,
				measure: "referendum-vote-share",
				members: { "referendum-answer": answer },
			},
		]),
	],
};

export const BREXIT_CONSTITUENCY: DeclaredDataset = {
	type: "brexitConstituency",
	module: "politics",
	payload: {
		parts: yearParts(
			"brexitConstituency",
			"constituency",
			2015,
			{ coverageCountries: ["GB-ENG"] },
			["2016"],
		),
		code: "constituencyCode",
		/** Leave where more than half voted to leave. */
		summary: (records) => ({
			results: Object.fromEntries(
				Object.entries(records).map(([code, record]) => {
					const { pctLeave } = record as { pctLeave: number };
					return [
						code,
						pctLeave > 50
							? "leave"
							: pctLeave < 50
								? "remain"
								: null,
					];
				}),
			),
		}),
	},
	name: "constituencyName",
	period: referendumDay,
	measures: REFERENDUM,
	dimensions: [ANSWER],
	fields: [
		{
			path: "pctLeave",
			measure: "referendum-vote-share",
			members: { "referendum-answer": "leave" },
			status: {
				path: "isKnownResult",
				values: { observed: true, estimated: false },
			},
		},
	],
};
