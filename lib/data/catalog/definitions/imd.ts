import { loadIMD } from "../../imd/loader";
import type { IMDDataset } from "@/lib/types/imd";
import type { DatasetDefinition } from "../types";

export const imdDatasetDefinition: DatasetDefinition<IMDDataset> = {
	type: "imd",
	precompiledFile: "imd",
	boundaryType: "lsoa",
	source: {
		name: "Indices of Multiple Deprivation",
		source: "Ministry of Housing, Communities & Local Government",
		sourceUrl:
			"https://www.gov.uk/government/statistics/english-indices-of-deprivation-2019",
		year: "2019",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Deprivation scores, ranks and deciles by small area (LSOA) for England.",
	},
	precompile: async ({ text }) => loadIMD(text),
};
