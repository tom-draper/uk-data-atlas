import { simdDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { SIMDDataset } from "@/lib/types/simd";
import type { ChartDatasetDefinition } from "./types";

export const simdDefinition: ChartDatasetDefinition<SIMDDataset> = {
	...simdDatasetDefinition,
	chart: { group: "Deprivation", key: "deprivation-simd", label: "Deprivation (SIMD) [2020]", defaultVisible: false, componentPath: "@/components/deprivation/simd/SIMDChart", boundaryType: "dataZone", calculateStats: (mm, g, d, l, id) => mm.calculateSIMDStats(g, d, l, id), year: 2020 },
	map: { valueKey: "simdRank", colorRange: { min: 1, max: 6976 }, legend: { min: 1, max: 6976, format: String }, invertColor: false },
};
