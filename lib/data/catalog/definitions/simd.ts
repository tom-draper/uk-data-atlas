import { loadSIMD } from "../../simd/loader";
import type { SIMDDataset } from "@/lib/types/simd";
import type { DatasetDefinition } from "../types";

export const simdDatasetDefinition: DatasetDefinition<SIMDDataset> = {
	type: "simd",
	precompiledFile: "simd",
	boundaryType: "dataZone",
	source: {
		name: "Scottish Index of Multiple Deprivation",
		source: "Scottish Government",
		sourceUrl:
			"https://www.gov.scot/collections/scottish-index-of-multiple-deprivation-2020/",
		year: "2020",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Deprivation scores, ranks and quintiles by data zone for Scotland.",
	},
	precompile: async ({ text }) => loadSIMD(text),
};
