import { loadRegionalGdpItl2 } from "../../regional-gdp/loader";
import type { RegionalGdpItl2Dataset } from "@/lib/types/regionalGdp";
import type { DatasetDefinition } from "../types";
import {
	REGIONAL_GDP_SOURCE,
	regionalGdpDescription,
	regionalGdpName,
} from "../../regional-gdp/source";

export const regionalGdpItl2DatasetDefinition: DatasetDefinition<RegionalGdpItl2Dataset> =
	{
		type: "regionalGdpItl2",
		precompiledFile: "regional-gdp-itl2",
		boundaryType: "itl2",
		coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
		source: {
			...REGIONAL_GDP_SOURCE,
			name: regionalGdpName("ITL2"),
			description: regionalGdpDescription("the forty-six ITL2 regions"),
		},
		ingestion: {
			minimumDatasets: 26,
			minimumDataRecords: 46,
			expectedBoundaryYears: [2025],
			requiredDataFields: ["gvaMillionGbp", "gdpMillionGbp"],
		},
		// No chart yet: the site has never drawn the ITL tiers, and the API
		// serves this series without one.
		chartPending: true,
		precompile: ({ text }) => loadRegionalGdpItl2(text),
	};
