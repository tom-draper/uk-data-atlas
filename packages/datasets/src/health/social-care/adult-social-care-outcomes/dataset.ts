import { directIndicator } from "../../../data/new-datasets/directIndicator.ts";
import { parseNullableNum } from "../../../helpers/parseNumber.ts";
import type { IndicatorDataset } from "../../../types/indicator.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { averageIndicator } from "../../../data/new-datasets/aggregate.ts";

export const adultSocialCareOutcomes = defineDataset<
	IndicatorDataset<"adult-social-care-outcomes">
>({
	id: "adult-social-care-outcomes",
	topic: "social-care",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG"],
	guide: {
		title: "Adult Social Care Outcomes Framework, England",
		about: "How people who use adult social care in England rate their quality of life, scored out of 24 from a national survey. It's one of the main ways the government compares how well council care services work.",
		summary:
			"The care-related quality-of-life outcome score reported by English councils.",
	},
	mapName: "Adult Social Care Quality of Life",
	source: {
		name: "Adult Social Care Outcomes Framework, England",
		publisher: "Department of Health and Social Care",
		sourceUrl:
			"https://www.gov.uk/government/statistics/measures-from-the-adult-social-care-outcomes-framework-england-2024-to-2025",
		year: "2024-25",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Department of Health and Social Care. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Social care-related quality-of-life score for local authorities, out of 24.",
		cadence: "annual",
		notes: [
			"The total-population council outcome score from ASCOF table 1a.",
		],
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2025],
	},
	statistics: {
		payload: {
			parts: yearParts(
				"adult-social-care-outcomes",
				"localAuthority",
				2025,
				{ coverageCountries: ["GB-ENG"] },
				["2025"],
			),
			code: "code",
		},
		name: "name",
		period: () => periods.financialYear(2024),
		measures: [
			measure(
				"social-care-quality-of-life",
				"Social care-related quality of life",
				"score out of 24",
				"index",
				"none",
				"Average social care-related quality of life score of service users (ASCOF 1A).",
			),
		],
		fields: [{ path: "value", measure: "social-care-quality-of-life" }],
		direct: {
			only: true,
			read: (reader) =>
				directIndicator(reader, {
					id: "adult-social-care-outcomes",
					file: "dhsc-ascof-england-2024-to-2025-outcome-and-demographic-data-23-january-2026.ods",
					table: "Table_1a",
					columns: 16,
					key: "2025",
					measure: "social-care-quality-of-life",
					read: (rows) => {
						return rows
							.slice(6)
							.filter(
								(row) =>
									row[3] === "Local Authority" &&
									row[4] === "Total" &&
									row[5] === "Total",
							)
							.map((row) => ({
								code: row[1]?.trim() ?? "",
								name: row[0]?.trim() ?? "",
								value: parseNullableNum(row[8]),
							}));
					},
				}),
		},
	},
	catalogue: {
		kind: "indicators",
		period: "2024-25",
		coverageNote:
			"Values are source-reported for the authorities included in the publisher's release.",
		indicators: [
			{
				id: "adult-social-care-outcomes",
				label: "Social care-related quality of life",
				field: "value",
				valueKind: "ratio",
				unit: "score out of 24",
				aggregation: {
					kind: "non-aggregatable",
					statistic: "median",
					note: "This is a survey outcome score, not a count that can be summed.",
				},
				notes: [],
				measure: "social-care-quality-of-life",
			},
		],
	},
	display: {
		label: "Social Care Quality of Life [2025]",
		year: 2025,
		card: {
			heading: "Social care quality of life",
			source: "Source and methodology are available in the data catalogue.",
			hoverRecord: true,
		},
		measures: [
			{
				id: "value",
				label: "Quality of life",
				field: "value",
				colorRange: { min: 15, max: 22 },
				legend: {
					min: 0,
					max: 24,
					format: { kind: "decimal", digits: 1 },
				},
				card: { unit: "/ 24", digits: 1, maximum: 24 },
			},
		],
		aggregation: { scope: "any", aggregate: averageIndicator },
	},
});
