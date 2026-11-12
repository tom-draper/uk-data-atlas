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
import { LIFE_EXPECTANCY, POPULATION, SEX, measure } from "./measures.ts";

/** Population and life expectancy. */

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
