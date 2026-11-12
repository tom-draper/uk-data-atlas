import { AGE, byAge } from "@uk-data-atlas/datasets";
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
