import { imdDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { IMDDataset } from "@/lib/types/imd";
import type { ChartDatasetDefinition } from "./types";

export const imdDefinition: ChartDatasetDefinition<IMDDataset> = {
	...imdDatasetDefinition,
	chart: { group: "Deprivation", key: "deprivation-imd", label: "Deprivation (IMD) [2019]", defaultVisible: true, componentPath: "@/components/deprivation/imd/IMDChart", calculateStats: (mm, g, d, l, id) => mm.calculateIMDStats(g, d, l, id), year: 2019 },
	map: { valueKey: "imdScore", colorRange: { min: 1, max: 70 }, legend: { min: 1, max: 70, format: String } },
};
