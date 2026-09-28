import { loadRegionalGdpItl1 } from "../../regional-gdp/loader";
import type { RegionalGdpItl1Dataset } from "@/lib/types/regionalGdp";
import type { DatasetDefinition } from "../types";
import {
	REGIONAL_GDP_SOURCE,
	regionalGdpDescription,
	regionalGdpName,
} from "../../regional-gdp/source";

export const regionalGdpItl1DatasetDefinition: DatasetDefinition<RegionalGdpItl1Dataset> =
	{
		type: "regionalGdpItl1",
		precompiledFile: "regional-gdp-itl1",
		boundaryType: "itl1",
		coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
		source: {
			...REGIONAL_GDP_SOURCE,
			name: regionalGdpName("ITL1"),
			description: regionalGdpDescription(
				"the twelve ITL1 regions and nations",
			),
		},
		ingestion: {
			minimumDatasets: 26,
			minimumDataRecords: 12,
			expectedBoundaryYears: [2025],
			requiredDataFields: ["gvaMillionGbp", "gdpMillionGbp"],
		},
		// No chart yet: the site has never drawn the ITL tiers, and the API
		// serves this series without one.
		chartPending: true,
		precompile: ({ text }) => loadRegionalGdpItl1(text),
	};
