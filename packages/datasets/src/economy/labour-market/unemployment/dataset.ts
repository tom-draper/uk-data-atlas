import type { UnemploymentDataset } from "../../../types/unemployment.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import { type Json, periods } from "../../../declaration/statistics.ts";
import { APRIL_2023_LAD_MERGERS } from "../../../data/localAuthority/reorganisations.ts";
import { aggregateUnemployment } from "../../../data/unemployment/aggregate.ts";
import { loadUnemployment } from "../../../data/unemployment/loader.ts";

/** Years to 2003 are April to March; later ones are calendar years. */
const unemploymentPeriod = (key: string) =>
	Number(key) <= 2003
		? periods.financialYear(Number(key))
		: periods.year(Number(key));

/** The most districts any 2023 unitary was formed from. */
const MOST_PREDECESSORS = Math.max(
	...Object.values(APRIL_2023_LAD_MERGERS).map(
		({ predecessors }) => predecessors.length,
	),
);

const periodText = (year: number) =>
	year <= 2003
		? `April ${year} to March ${year + 1}`
		: `January to December ${year}`;

export const unemployment = defineDataset<UnemploymentDataset>({
	id: "unemployment",
	topic: "labour-market",
	boundary: { type: "localAuthority", year: 2024 },
	coverageCountries: ["GB-ENG", "GB-SCT", "GB-WLS"],
	source: {
		name: "Unemployment",
		publisher: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/datasets/modelledunemploymentforlocalandunitaryauthoritiesm01/current",
		year: "2021",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Final model-based unemployment rate estimates by local authority for Great Britain. ONS discontinued this series in August 2022.",
		cadence: "discontinued",
		notes: [],
	},
	// The local authority rates and levels sheets; the workbook also holds
	// the same pair on 2010 constituencies.
	load: async ({ xlsSheet }) => loadUnemployment(xlsSheet),
	statistics: {
		payload: {
			parts: () => [
				{
					key: "2021",
					header: {
						id: "unemployment",
						type: "unemployment",
						year: 2021,
						boundaryType: "localAuthority",
						boundaryYear: 2024,
						latestYear: 2021,
						coverageCountries: ["GB-ENG", "GB-SCT", "GB-WLS"],
					},
				},
			],
			code: "ladCode",
			arrays: ["derivedFromPredecessors"],
			/** The compiler publishes no intervals for figures built from predecessors. */
			without: (relations) =>
				relations.has("predecessor")
					? ["rateIntervals", "levelIntervals"]
					: [],
			periodKeys: Array.from({ length: 26 }, (_, index) =>
				String(1996 + index),
			),
			/** The years any area has a rate for, with how each is described. */
			summary: (records) => {
				const years = [
					...new Set(
						Object.values(records).flatMap((record) =>
							Object.keys(
								(record as { rates?: Record<string, Json> })
									.rates ?? {},
							),
						),
					),
				]
					.map(Number)
					.sort((a, b) => a - b);
				return {
					years,
					periodLabels: Object.fromEntries(
						years.map((year) => [year, periodText(year)]),
					),
				};
			},
		},
		name: "ladName",
		period: () => periods.year(2021),
		alsoIn: [
			{ geography: "localAuthority", year: 2019 },
			{ geography: "localAuthority", year: 2015 },
		],
		/** The districts a 2023 unitary's figures were built from, one per index. */
		parents: Array.from({ length: MOST_PREDECESSORS }, (_, index) => ({
			relation: "predecessor",
			code: `derivedFromPredecessors.${index}`,
			release: { geography: "localAuthority", year: 2021 },
		})),
		measures: [
			measure(
				"unemployment-rate",
				"Unemployment rate",
				"percent",
				"rate",
				"none",
				"Model-based unemployed residents aged 16 and over as a percentage of the economically active.",
			),
			measure(
				"unemployment-rate-interval",
				"Unemployment rate confidence interval",
				"percentage points",
				"rate",
				"none",
				"Half-width of the published 95% confidence interval around the unemployment rate.",
			),
			measure(
				"unemployed-people",
				"Unemployed people",
				"people",
				"count",
				"sum",
				"Model-based unemployed residents aged 16 and over.",
			),
			measure(
				"unemployed-people-interval",
				"Unemployed people confidence interval",
				"people",
				"count",
				"none",
				"Half-width of the published 95% confidence interval around unemployed people.",
			),
		],
		fields: [
			["rates", "unemployment-rate"],
			["rateIntervals", "unemployment-rate-interval"],
			["levels", "unemployed-people"],
			["levelIntervals", "unemployed-people-interval"],
		].map(([field, measure]) => ({
			path: `${field}.{period}`,
			measure,
			period: unemploymentPeriod,
		})),
	},
	display: {
		label: "Historic Unemployment Rate [2021]",
		year: 2021,
		component:
			"@/components/datasets/economy/labour-market/unemployment/UnemploymentChart",
		// The series ended in 2021, so the map reads that year.
		measures: [
			{
				id: "rate",
				label: "Rate",
				field: "rates.2021",
				colorRange: { min: 2.2, max: 6.8 },
				legend: {
					min: 2.2,
					max: 6.8,
					format: { kind: "decimal", digits: 1, suffix: "%" },
				},
			},
			{
				id: "count",
				label: "Count",
				field: "levels.2021",
				colorRange: { min: 1000, max: 11000 },
				legend: {
					min: 0,
					max: 45000,
					format: { kind: "count", suffix: " unemployed" },
				},
			},
		],
		aggregation: {
			scope: "localAuthority",
			aggregate: aggregateUnemployment,
		},
	},
});
