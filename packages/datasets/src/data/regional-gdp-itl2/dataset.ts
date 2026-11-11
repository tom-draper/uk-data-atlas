import type { RegionalGdpItl2Dataset } from "../../types/regionalGdp.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { loadRegionalGdpItl2 } from "../regional-gdp/loader.ts";
import {
	REGIONAL_GDP_SOURCE,
	regionalGdpDescription,
	regionalGdpName,
} from "../regional-gdp/source.ts";
import { regionalGdpStatistics } from "../regional-gdp/statistics.ts";

export const regionalGdpItl2 = defineDataset<RegionalGdpItl2Dataset>({
	id: "regional-gdp-itl2",
	module: "economy",
	boundary: { type: "itl2", year: 2025 },
	coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
	chartPending: true,
	source: {
		name: regionalGdpName("ITL2"),
		publisher: REGIONAL_GDP_SOURCE.source,
		sourceUrl: REGIONAL_GDP_SOURCE.sourceUrl,
		year: REGIONAL_GDP_SOURCE.year,
		licence: REGIONAL_GDP_SOURCE.licence,
		licenceUrl: REGIONAL_GDP_SOURCE.licenceUrl,
		description: regionalGdpDescription("the forty-six ITL2 regions"),
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		cadence: "annual",
		notes: [],
	},
	ingestion: {
		minimumDatasets: 26,
		minimumDataRecords: 46,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["gvaMillionGbp", "gdpMillionGbp"],
	},
	load: ({ text }) => loadRegionalGdpItl2(text),
	statistics: regionalGdpStatistics,
});
