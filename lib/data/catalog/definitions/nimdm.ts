import { loadNIMDM } from "../../nimdm/loader";
import type { NIMDMDataset } from "@/lib/types/nimdm";
import type { DatasetDefinition } from "../types";

export const nimdmDatasetDefinition: DatasetDefinition<NIMDMDataset> = {
	type: "nimdm",
	precompiledFile: "nimdm",
	boundaryType: "superOutputArea",
	source: {
		name: "Northern Ireland Multiple Deprivation Measure",
		source: "Northern Ireland Statistics and Research Agency",
		sourceUrl:
			"https://www.nisra.gov.uk/statistics/deprivation/northern-ireland-multiple-deprivation-measure-2017-nimdm2017",
		year: "2017",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Deprivation scores, ranks and deciles by super output area for Northern Ireland.",
	},
	precompile: async ({ text }) => loadNIMDM(text),
};
