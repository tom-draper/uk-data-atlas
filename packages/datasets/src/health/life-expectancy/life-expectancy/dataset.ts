import type { LifeExpectancyDataset } from "../../../types/lifeExpectancy.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import {
	LIFE_EXPECTANCY,
	SEX,
	measure,
} from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { loadLE } from "../../../data/life-expectancy/loader.ts";

const HEALTHY_LIFE_EXPECTANCY = measure(
	"healthy-life-expectancy",
	"Healthy life expectancy at birth",
	"years",
	"mean",
	"none",
	"Average years a newborn would live in very good or good health at the period's rates.",
);

/** `2022-2024`, with a hyphen or an en dash. */
const yearRange = (text: unknown) => {
	const match = /^(\d{4})[-–](\d{4})$/.exec(String(text));
	if (!match) throw new Error(`Unknown year range ${String(text)}`);
	return periods.years(Number(match[1]), Number(match[2]));
};

const COUNTRIES = ["GB-ENG", "GB-SCT", "GB-WLS", "GB-NIR"];

/** One of the two source workbooks, as a payload part. */
const part = (
	key: "le" | "hle",
	label: string,
	source: string,
	note: string,
) => ({
	key,
	header: {
		id: key,
		year: 2024,
		type: "life-expectancy",
		boundaryType: "localAuthority",
		boundaryYear: 2023,
		dataPeriod: "2022–2024",
		label,
		coverageCountries: COUNTRIES,
		metadata: { source, notes: [note] },
	},
});

export const lifeExpectancy = defineDataset<LifeExpectancyDataset>({
	id: "life-expectancy",
	topic: "life-expectancy",
	boundary: { type: "localAuthority", year: 2024 },
	source: {
		name: "Life Expectancy",
		publisher: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/peoplepopulationandcommunity/healthandsocialcare/healthandlifeexpectancies/bulletins/lifeexpectancyforlocalareasoftheuk/between2001to2003and2022to2024",
		year: "2022-2024",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Life expectancy and healthy life expectancy estimates by local area across the UK.",
		cadence: "annual",
		notes: [],
	},
	// Both source workbooks carry their local-area data on sheet 1.
	load: async ({ xlsxSheetSelectedRows }) => loadLE(xlsxSheetSelectedRows),
	statistics: {
		payload: {
			parts: () => [
				part(
					"le",
					"Life Expectancy",
					"Office for National Statistics. Life expectancy for local areas of the UK: 2022 to 2024.",
					"Life expectancy at birth. UK local authorities.",
				),
				part(
					"hle",
					"Healthy Life Expectancy",
					"Office for National Statistics. Healthy life expectancy, UK: 2022 to 2024.",
					"Healthy life expectancy at birth. UK local authorities.",
				),
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
			const slug = {
				le: "life-expectancy",
				hle: "healthy-life-expectancy",
			}[key];
			if (!slug) throw new Error(`Unknown life expectancy table ${key}`);
			return [
				{
					path: "maleBirthLE",
					measure: slug,
					members: { sex: "male" },
				},
				{
					path: "femaleBirthLE",
					measure: slug,
					members: { sex: "female" },
				},
			];
		},
	},
});
