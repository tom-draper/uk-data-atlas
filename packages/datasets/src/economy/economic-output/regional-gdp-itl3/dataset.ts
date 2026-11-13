import type { RegionalGdpItl3Dataset } from "../../../types/regionalGdp.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import type { DisplayFormat } from "../../../declaration/display.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { aggregateRegionalGdp } from "../../../data/regional-gdp/aggregate.ts";
import { loadRegionalGdpItl3 } from "../../../data/regional-gdp/loader.ts";
import {
	REGIONAL_GDP_SOURCE,
	regionalGdpDescription,
	regionalGdpName,
} from "../../../data/regional-gdp/source.ts";
import { regionalGdpStatistics } from "../../../data/regional-gdp/statistics.ts";

const COVERAGE = ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"] as const;

const money: DisplayFormat = { kind: "millions", prefix: "£" };

export const regionalGdpItl3 = defineDataset<RegionalGdpItl3Dataset>({
	id: "regional-gdp-itl3",
	topic: "economic-output",
	boundary: { type: "itl3", year: 2025 },
	coverageCountries: [...COVERAGE],
	source: {
		name: regionalGdpName("ITL3"),
		publisher: REGIONAL_GDP_SOURCE.source,
		sourceUrl: REGIONAL_GDP_SOURCE.sourceUrl,
		year: REGIONAL_GDP_SOURCE.year,
		licence: REGIONAL_GDP_SOURCE.licence,
		licenceUrl: REGIONAL_GDP_SOURCE.licenceUrl,
		description: regionalGdpDescription("the 182 ITL3 areas"),
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		cadence: "annual",
		notes: [],
	},
	ingestion: {
		minimumDatasets: 26,
		minimumDataRecords: 182,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["gvaMillionGbp", "gdpMillionGbp"],
	},
	load: ({ text }) => loadRegionalGdpItl3(text),
	statistics: {
		...regionalGdpStatistics,
		payload: {
			...regionalGdpStatistics.payload,
			parts: yearParts("regional-gdp-itl3", "itl3", 2025, {
				coverageCountries: [...COVERAGE],
			}),
		},
	},
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
