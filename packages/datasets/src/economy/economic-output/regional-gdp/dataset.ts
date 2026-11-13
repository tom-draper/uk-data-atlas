import type { RegionalGdpDataset } from "../../../types/regionalGdp.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import type { DisplayFormat } from "../../../declaration/display.ts";
import { aggregateRegionalGdp } from "../../../data/regional-gdp/aggregate.ts";
import { loadRegionalGdp } from "../../../data/regional-gdp/loader.ts";
import {
	REGIONAL_GDP_SOURCE,
	regionalGdpDescription,
} from "../../../data/regional-gdp/source.ts";
import { regionalGdpStatistics } from "../../../data/regional-gdp/statistics.ts";

const COVERAGE = ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"] as const;

const money: DisplayFormat = { kind: "millions", prefix: "£" };

export const regionalGdp = defineDataset<RegionalGdpDataset>({
	id: "regional-gdp",
	topic: "economic-output",
	boundary: { type: "itl3", year: 2025 },
	additionalBoundaryTypes: ["itl1", "itl2"],
	coverageCountries: [...COVERAGE],
	source: {
		name: "Regional gross domestic product",
		publisher: REGIONAL_GDP_SOURCE.source,
		sourceUrl: REGIONAL_GDP_SOURCE.sourceUrl,
		year: REGIONAL_GDP_SOURCE.year,
		licence: REGIONAL_GDP_SOURCE.licence,
		licenceUrl: REGIONAL_GDP_SOURCE.licenceUrl,
		description: regionalGdpDescription("the ITL1, ITL2 and ITL3 regions"),
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		cadence: "annual",
		notes: [],
	},
	ingestion: {
		minimumDatasets: 78,
		// The smallest tier, ITL1; the catalogue compiler checks each tier's count.
		minimumDataRecords: 12,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["gvaMillionGbp", "gdpMillionGbp"],
	},
	load: ({ text }) => loadRegionalGdp(text),
	statistics: regionalGdpStatistics(),
	display: {
		label: "Regional GDP [2023]",
		year: 2023,
		card: {
			heading: "Regional GDP",
			coverage: "United Kingdom",
			source: "Office for National Statistics. Regional gross domestic product and gross value added. ons.gov.uk",
		},
		measures: [
			{
				id: "gdp",
				label: "GDP",
				field: "gdpMillionGbp",
				colorRange: { min: 0, max: 50_000 },
				legend: {
					min: 0,
					max: 210_000,
					format: { ...money, suffix: " GDP" },
				},
				card: { format: money, maximum: 210_000 },
			},
			{
				id: "gva",
				label: "GVA",
				field: "gvaMillionGbp",
				colorRange: { min: 0, max: 50_000 },
				legend: {
					min: 0,
					max: 210_000,
					format: { ...money, suffix: " GVA" },
				},
				card: {
					format: money,
					maximum: 210_000,
					heading: "Regional GVA",
				},
			},
		],
		aggregation: { scope: "itl3", aggregate: aggregateRegionalGdp },
	},
});
