import { loadWIMD } from "../../wimd/loader";
import type { WIMDDataset } from "@/lib/types/wimd";
import type { DatasetDefinition } from "../types";

export const wimdDatasetDefinition: DatasetDefinition<WIMDDataset> = {
	type: "wimd",
	precompiledFile: "wimd",
	boundaryType: "lsoa",
	source: {
		name: "Welsh Index of Multiple Deprivation",
		source: "Welsh Government",
		sourceUrl: "https://www.gov.wales/welsh-index-multiple-deprivation",
		year: "2019",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Deprivation scores, ranks and deciles by lower super output area for Wales.",
	},
	precompile: async ({ text }) => loadWIMD(text),
};
