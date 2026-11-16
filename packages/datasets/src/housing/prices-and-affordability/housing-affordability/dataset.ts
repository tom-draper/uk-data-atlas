import { parseCsv } from "../../../helpers/parseCsv.ts";
import { parseNullableNum } from "../../../helpers/parseNumber.ts";
import { authorityCode } from "../../../data/new-datasets/authorityCode.ts";
import { sourceDir } from "../../../declaration/sources.ts";
import type { DirectRecord } from "../../../declaration/statistics.ts";
import type { IndicatorDataset } from "../../../types/indicator.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { averageIndicator } from "../../../data/new-datasets/aggregate.ts";
import { loadHousingAffordability } from "../../../data/new-datasets/loader.ts";

export const housingAffordability = defineDataset<
	IndicatorDataset<"housing-affordability">
>({
	id: "housing-affordability",
	topic: "prices-and-affordability",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
	publishMapValues: true,
	related: ["earnings-and-income"],
	source: {
		name: "House price to residence-based earnings ratio",
		publisher: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/peoplepopulationandcommunity/housing/datasets/ratioofhousepricetoresidencebasedearningslowerquartileandmedian",
		year: "2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Ratio of the median price paid for existing dwellings to median gross annual residence-based earnings, by local authority district.",
		cadence: "annual",
		notes: [],
	},
	ingestion: {
		minimumDataRecords: 300,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["value"],
	},
	load: ({ xlsxSheet }) => loadHousingAffordability(xlsxSheet),
	placeHeadline: {
		places: ["localAuthority"],
		order: 20,
		label: "Housing affordability",
		about: "Median house price as a multiple of median earnings",
		format: { kind: "decimal", digits: 1, suffix: "×" },
	},
	statistics: {
		payload: {
			parts: yearParts(
				"housing-affordability",
				"localAuthority",
				2025,
				{ coverageCountries: ["GB-ENG", "GB-WLS"] },
				["2025"],
			),
			code: "code",
		},
		name: "name",
		period: () => periods.year(2025),
		measures: [
			measure(
				"house-price-to-earnings-ratio",
				"House price to earnings ratio",
				"ratio",
				"index",
				"none",
				"Median price of existing dwellings divided by median gross annual residence-based earnings.",
			),
		],
		fields: [{ path: "value", measure: "house-price-to-earnings-ratio" }],
		direct: {
			read: async ({ xlsxSheet }) => {
				const { data: rows } = await parseCsv<string[]>(
					await xlsxSheet(
						sourceDir(
							"housing-affordability",
							"ons-ew-existing-dwellings-residence-earnings-2025.xlsx",
						),
						"5c",
					),
					{ header: false },
				);
				const header = rows.findIndex(
					(row) => row[2]?.trim() === "Local authority code",
				);
				const column = (rows[header] ?? []).findIndex(
					(value) => value?.trim() === "2025",
				);
				if (header < 0 || column < 0)
					throw new Error(
						"Housing affordability table 5c has no 2025 local authority column",
					);
				const records = new Map<string, DirectRecord>();
				for (const row of rows.slice(header + 1)) {
					const code = row[2]?.trim() ?? "";
					const value = parseNullableNum(row[column]);
					if (!authorityCode(code) || value === null) continue;
					records.set(code, {
						code,
						name: row[3]?.trim() || code,
						values: [
							{ measure: "house-price-to-earnings-ratio", value },
						],
					});
				}
				return [{ key: "2025", records: [...records.values()] }];
			},
		},
	},
	display: {
		label: "Housing Affordability [2025]",
		year: 2025,
		card: {
			heading: "House price to earnings",
			source: "Source and methodology are available in the data catalogue.",
			secondaryText: "Median ratio",
			hoverRecord: true,
		},
		measures: [
			{
				id: "value",
				label: "Ratio",
				field: "value",
				colorRange: { min: 4, max: 14 },
				legend: {
					min: 0,
					max: 20,
					format: { kind: "decimal", digits: 0, suffix: "×" },
				},
				card: { unit: "× earnings", digits: 1, maximum: 20 },
			},
		],
		aggregation: { scope: "any", aggregate: averageIndicator },
	},
});
