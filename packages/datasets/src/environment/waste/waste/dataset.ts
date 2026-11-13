import type { IndicatorDataset } from "../../../types/indicator.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import type {
	DatasetDisplay,
	DisplayMeasure,
} from "../../../declaration/display.ts";
import { measure, per100k } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { loadWaste } from "../../../data/new-datasets/loader.ts";
import { addPopulationMetrics } from "../../../data/population/metrics.ts";
import { loadPopulationUk } from "../../../data/population/ukLoader.ts";
import { aggregateWaste } from "../../../data/waste/aggregate.ts";

const TONNES = { kind: "count", locale: "en-GB" } as const;

/** The tonnage measures: collected and recycled, as a total and per 100,000 residents. */
const tonnage = (
	id: string,
	label: string,
	field: DisplayMeasure["field"],
	basis: "total" | "rate",
	heading: string,
	note?: string,
): DisplayMeasure => ({
	id,
	label,
	field,
	colorRange: { min: 0, max: basis === "total" ? 200_000 : 60_000 },
	legend: {
		min: 0,
		max: 500_000,
		format: {
			...TONNES,
			suffix: basis === "total" ? " t" : " t per 100k",
		},
	},
	card: {
		unit: basis === "total" ? "tonnes" : "tonnes per 100k",
		digits: 0,
		maximum: basis === "total" ? 500_000 : 60_000,
		heading,
		...(note ? { note } : {}),
	},
});

const INCLUDES_REUSE = "Includes composting and reuse";

export const waste = defineDataset<IndicatorDataset<"waste">>({
	id: "waste",
	topic: "waste",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG"],
	source: {
		name: "Local authority collected waste management",
		publisher: "Department for Environment, Food and Rural Affairs",
		sourceUrl:
			"https://www.gov.uk/government/statistics/local-authority-collected-waste-management-annual-results",
		year: "2024-25",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Department for Environment, Food and Rural Affairs. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Local-authority collected waste in England; collection authorities only to avoid double counting.",
		cadence: "annual",
		notes: [],
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["value"],
	},
	load: async ({ odsTableRows, xlsxSheet }) => {
		const datasets = await loadWaste(odsTableRows);
		const population = await loadPopulationUk(xlsxSheet);
		for (const dataset of Object.values(datasets)) {
			addPopulationMetrics(
				dataset.data,
				population["2024"]?.data ?? {},
				(record) => record.value,
			);
		}
		return datasets;
	},
	statistics: {
		payload: {
			parts: yearParts(
				"waste",
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
				"collected-waste",
				"Local authority collected waste",
				"tonnes",
				"amount",
				"sum",
				"Waste collected by the local authority, collection authorities only.",
			),
			measure(
				"household-waste-recycled",
				"Household waste sent for recycling",
				"tonnes",
				"amount",
				"sum",
				"Household waste sent for reuse, recycling or composting.",
			),
		],
		fields: [
			{ path: "value", measure: "collected-waste" },
			{
				path: "metrics.recycledTonnes",
				measure: "household-waste-recycled",
			},
		],
		...per100k((record) => record.value, 2024),
	},
	display: {
		label: "Collected Waste [2025]",
		year: 2025,
		card: {
			heading: "Collected waste",
			period: "2024/25",
			coverage: "England",
			source: "Defra. Local-authority collected waste, 2024/25. Recycling includes composting and reuse. gov.uk",
		},
		measures: [
			tonnage(
				"collected",
				"Collected",
				"value",
				"total",
				"Collected waste",
			),
			tonnage(
				"collected-per-100k",
				"Collected per 100k",
				"metrics.per100kPopulation",
				"rate",
				"Collected waste",
			),
			tonnage(
				"recycled",
				"Recycled",
				"metrics.recycledTonnes",
				"total",
				"Recycled waste",
				INCLUDES_REUSE,
			),
			tonnage(
				"recycled-per-100k",
				"Recycled per 100k",
				{
					apportion: {
						amount: "metrics.per100kPopulation",
						part: "metrics.recycledTonnes",
						whole: "value",
					},
				},
				"rate",
				"Recycled waste",
				INCLUDES_REUSE,
			),
			{
				id: "recycling-share",
				label: "Recycling %",
				field: {
					share: { of: "metrics.recycledTonnes", over: "value" },
				},
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% recycled",
					},
				},
				card: {
					unit: "% recycled",
					digits: 1,
					maximum: 100,
					heading: "Recycling share",
					note: INCLUDES_REUSE,
				},
			},
		] as unknown as DatasetDisplay["measures"],
		aggregation: { scope: "localAuthority", aggregate: aggregateWaste },
	} satisfies DatasetDisplay,
});
