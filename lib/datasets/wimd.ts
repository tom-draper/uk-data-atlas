import { wimdDatasetDefinition } from "@/lib/data/catalog/definitions";
import { wimdAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { WIMDDataset } from "@/lib/types/wimd";
import { deprivationRankMap } from "./deprivationRankMap";
import type { ChartDatasetDefinition } from "./types";

export const wimdDefinition: ChartDatasetDefinition<WIMDDataset> = {
	...wimdDatasetDefinition,
	chart: {
		group: "Deprivation",
		key: "deprivation-wimd",
		label: "Deprivation (WIMD) [2019]",
		defaultVisible: false,
		componentPath: "@/components/deprivation/wimd/WIMDChart",
		calculateStats: (mm, g, d, l, id) =>
			mm.aggregate(wimdAggregation, g, d, l, id),
		year: 2019,
	},
	map: deprivationRankMap<WIMDDataset>("wimdRank", 1909),
};
