import {
	type DeclaredDataset,
	type DeclaredDimension,
	type DeclaredField,
	type DeclaredParent,
	type DeclaredHeader,
	periods,
} from "../declaredStatistics";
import {
	ELECTORATE,
	LIFE_EXPECTANCY,
	POPULATION,
	REJECTED_BALLOTS,
	SEX,
	TURNOUT,
	VALID_VOTES,
	measure,
} from "./measures";

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
	name: "wardName",
	parents: [
		{
			code: "ladCode",
			name: "ladName",
			release: { geography: "localAuthority", year: 2023 },
		},
	],
	rebuild: {},
	measures: [POPULATION],
	dimensions: [SEX, AGE],
	fields: byAge,
};

export const POPULATION_UK: DeclaredDataset = {
	type: "populationUk",
	name: "ladName",
	rebuild: {},
	measures: [POPULATION],
	dimensions: [SEX, AGE],
	fields: byAge,
};

export const POPULATION_CONSTITUENCY: DeclaredDataset = {
	type: "populationConstituency",
	name: "constituencyName",
	rebuild: {},
	measures: [POPULATION],
	fields: [{ path: "total", measure: "population" }],
};

/** `2022-2024`, with a hyphen or an en dash. */
const yearRange = (text: unknown) => {
	const match = /^(\d{4})[-–](\d{4})$/.exec(String(text));
	if (!match) throw new Error(`Unknown year range ${String(text)}`);
	return periods.years(Number(match[1]), Number(match[2]));
};

export const LIFE_EXPECTANCY_SERIES: DeclaredDataset = {
	type: "lifeExpectancySeries",
	name: "ladName",
	rebuild: {},
	period: (_key, header: DeclaredHeader) => yearRange(header.period),
	measures: [LIFE_EXPECTANCY],
	dimensions: [SEX],
	fields: [
		{
			path: "{sex}.value",
			lower: "{sex}.lower",
			upper: "{sex}.upper",
			measure: "life-expectancy",
		},
	],
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
	name: "ladName",
	rebuild: {},
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
	name: "lsoaName",
	parents: districtParent("ladCode", "ladName"),
	rebuild: {},
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
	name: "lsoaName",
	parents: districtParent("ladCode", "ladName"),
	rebuild: {},
};

export const SIMD: DeclaredDataset = {
	...deprivation(
		"simd",
		"simd",
		"Scottish Index of Multiple Deprivation",
		"data zones in Scotland",
		{ quintile: true, decile: true },
	),
	name: "dzName",
	parents: districtParent("councilAreaCode", "councilAreaName"),
	rebuild: {},
};

export const NIMDM: DeclaredDataset = {
	...deprivation(
		"nimdm",
		"nimdm",
		"Northern Ireland Multiple Deprivation Measure",
		"super output areas in Northern Ireland",
		{},
	),
	name: "soaName",
	parents: districtParent("lgdCode", "lgdName"),
	rebuild: {},
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
	name: "ladName",
	parents: [
		{
			code: "regionCode",
			name: "regionName",
			release: { geography: "region", year: 2025 },
			alsoIn: [{ geography: "country", year: 2025 }],
		},
	],
	rebuild: {},
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
	rebuild: {},
};
