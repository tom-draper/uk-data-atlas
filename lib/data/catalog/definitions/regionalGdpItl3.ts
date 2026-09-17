import { loadRegionalGdpItl3 } from "../../regional-gdp/loader";
import type { RegionalGdpItl3Dataset } from "@/lib/types/regionalGdp";
import type { DatasetDefinition } from "../types";
import {
	REGIONAL_GDP_SOURCE,
	regionalGdpDescription,
	regionalGdpName,
} from "../../regional-gdp/source";

export const regionalGdpItl3DatasetDefinition: DatasetDefinition<RegionalGdpItl3Dataset> =
	{
		type: "regionalGdpItl3",
		precompiledFile: "regional-gdp-itl3",
		boundaryType: "itl3",
		coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
		source: {
			...REGIONAL_GDP_SOURCE,
			name: regionalGdpName("ITL3"),
			description: regionalGdpDescription("the 182 ITL3 areas"),
		},
		ingestion: {
			minimumDatasets: 26,
			minimumDataRecords: 182,
			expectedBoundaryYears: [2025],
			requiredDataFields: ["gvaMillionGbp", "gdpMillionGbp"],
		},
		// No chart yet: the site has never drawn the ITL tiers, and the API
		// serves this series without one.
		chartPending: true,
		precompile: ({ text }) => loadRegionalGdpItl3(text),
	};
