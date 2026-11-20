import type { LifeExpectancyDataset } from "../../../types/lifeExpectancy.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import {
	LIFE_EXPECTANCY,
	SEX,
	measure,
} from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { APRIL_2023_LAD_MERGERS } from "../../../data/localAuthority/reorganisations.ts";
import { aggregateLifeExpectancy } from "./aggregate.ts";
import { lifeExpectancyStatisticsParts } from "../../../data/life-expectancy/source.ts";

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

/** The most districts any 2023 authority was formed from. */
const MOST_PREDECESSORS = Math.max(
	...Object.values(APRIL_2023_LAD_MERGERS).map(
		({ predecessors }) => predecessors.length,
	),
);

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
	guide: {
		title: "Life Expectancy",
		about: "How long a baby born today could expect to live, and how many of those years in good health, if current death rates held. Figures are averaged over three years for each local area, and are one of the clearest measures of health inequality between places.",
	},
	mapName: "Life Expectancy",
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
			arrays: ["derivedFromPredecessors"],
		},
		/** Both source workbooks carry their local-area data on sheet 1. */
		direct: {
			only: true,
			read: ({ xlsxSheetSelectedRows }) =>
				lifeExpectancyStatisticsParts(xlsxSheetSelectedRows),
		},
		/** The districts a 2023 authority's estimate was built from, one per index. */
		parents: Array.from({ length: MOST_PREDECESSORS }, (_, index) => ({
			relation: "predecessor",
			code: `derivedFromPredecessors.${index}`,
			release: { geography: "localAuthority", year: 2022 },
		})),
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
	placeHeadline: {
		places: ["localAuthority"],
		order: 30,
		label: "Life expectancy",
		about: "At birth, the average of men and women",
		format: { kind: "decimal", digits: 1, suffix: " years" },
	},
	display: {
		label: "Life Expectancy [2022-2024]",
		year: 2024,
		component: "@/components/measures/MeasureBarsChart",
		bars: {
			heading: "Life Expectancy",
			measures: {
				le: "life-expectancy",
				hle: "healthy-life-expectancy",
			},
			views: { hle: "healthy-life-expectancy" },
			dimension: "sex",
			bars: [
				{ code: "male", label: "M" },
				{ code: "female", label: "F" },
			],
			// Each authority counts once, as the card has always averaged them.
			combine: "mean",
			ramp: { low: "#dcfce7", high: "#15803d" },
			digits: 1,
			// The measures are published with the series' release.
			release: {
				datasetId: "life-expectancy-series",
				boundaryYear: 2025,
			},
		},
		measures: [
			{
				id: "average",
				label: "Average",
				field: { mean: ["maleBirthLE", "femaleBirthLE"] },
				colorRange: { min: 72, max: 84 },
				rangeFromData: true,
				legend: {
					min: 72,
					max: 84,
					format: { kind: "decimal", digits: 1, suffix: "y" },
				},
			},
			{
				id: "male",
				label: "Male",
				field: "maleBirthLE",
				colorRange: { min: 72, max: 84 },
				rangeFromData: true,
				legend: {
					min: 72,
					max: 84,
					format: { kind: "decimal", digits: 1, suffix: "y" },
				},
			},
			{
				id: "female",
				label: "Female",
				field: "femaleBirthLE",
				colorRange: { min: 72, max: 84 },
				rangeFromData: true,
				legend: {
					min: 72,
					max: 84,
					format: { kind: "decimal", digits: 1, suffix: "y" },
				},
			},
		],
		aggregation: {
			scope: "localAuthority",
			distinct: true,
			aggregate: aggregateLifeExpectancy,
		},
	},
});
