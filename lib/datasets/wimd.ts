import { wimdDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { WIMDDataset } from "@/lib/types/wimd";
import type { ChartDatasetDefinition } from "./types";

export const wimdDefinition: ChartDatasetDefinition<WIMDDataset> = {
	...wimdDatasetDefinition,
	chart: { group: "Deprivation", key: "deprivation-wimd", label: "Deprivation (WIMD) [2019]", defaultVisible: false, componentPath: "@/components/deprivation/wimd/WIMDChart", calculateStats: (mm, g, d, l, id) => mm.calculateWIMDStats(g, d, l, id), year: 2019 },
	map: { valueKey: "wimdRank", colorRange: { min: 1, max: 1909 }, legend: { min: 1, max: 1909, format: String }, invertColor: false },
};
