import { loadSIMD } from "@/lib/data/simd/loader";
import type { SIMDDataset } from "@/lib/types/simd";
import type { ChartDatasetDefinition } from "./types";

export const simdDefinition: ChartDatasetDefinition<SIMDDataset> = {
	type: "simd", precompiledFile: "simd",
	chart: { group: "Deprivation", key: "deprivation-simd", label: "Deprivation (SIMD) [2020]", defaultVisible: false, componentPath: "@/components/deprivation/simd/SIMDChart", boundaryType: "dataZone", calculateStats: (mm, g, d, l, id) => mm.calculateSIMDStats(g, d, l, id), year: 2020 },
	source: { name: "Scottish Index of Multiple Deprivation", source: "Scottish Government", sourceUrl: "https://www.gov.scot/collections/scottish-index-of-multiple-deprivation-2020/", year: "2020", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Deprivation scores, ranks and quintiles by data zone for Scotland." },
	map: { valueFor: () => null, colorRange: { min: 1, max: 6976 }, legend: { min: 1, max: 6976, format: String } },
	precompile: async ({ text }) => loadSIMD(text),
};
