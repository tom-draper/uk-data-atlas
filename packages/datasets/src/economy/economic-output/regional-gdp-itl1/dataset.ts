import type { RegionalGdpItl1Dataset } from "../../../types/regionalGdp.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { loadRegionalGdpItl1 } from "../../../data/regional-gdp/loader.ts";
import {
	REGIONAL_GDP_SOURCE,
	regionalGdpDescription,
	regionalGdpName,
} from "../../../data/regional-gdp/source.ts";
import { regionalGdpStatistics } from "../../../data/regional-gdp/statistics.ts";

export const regionalGdpItl1 = defineDataset<RegionalGdpItl1Dataset>({
	id: "regional-gdp-itl1",
	topic: "economic-output",
	boundary: { type: "itl1", year: 2025 },
	coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
	chartPending: true,
	source: {
		name: regionalGdpName("ITL1"),
		publisher: REGIONAL_GDP_SOURCE.source,
		sourceUrl: REGIONAL_GDP_SOURCE.sourceUrl,
		year: REGIONAL_GDP_SOURCE.year,
		licence: REGIONAL_GDP_SOURCE.licence,
		licenceUrl: REGIONAL_GDP_SOURCE.licenceUrl,
		description: regionalGdpDescription(
			"the twelve ITL1 regions and nations",
		),
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		cadence: "annual",
		notes: [],
	},
	ingestion: {
		minimumDatasets: 26,
		minimumDataRecords: 12,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["gvaMillionGbp", "gdpMillionGbp"],
	},
	load: ({ text }) => loadRegionalGdpItl1(text),
	statistics: regionalGdpStatistics,
});
