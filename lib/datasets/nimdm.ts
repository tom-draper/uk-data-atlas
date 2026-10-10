import { nimdmDatasetDefinition } from "@/lib/data/catalog/definitions";
import { nimdmAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { NIMDMDataset } from "@/lib/types/nimdm";
import { deprivationRankMap } from "./deprivationRankMap";
import type { ChartDatasetDefinition } from "./types";

export const nimdmDefinition: ChartDatasetDefinition<NIMDMDataset> = {
	...nimdmDatasetDefinition,
	chart: {
		group: "Deprivation",
		key: "deprivation-nimdm",
		label: "Deprivation (NIMDM) [2017]",
		defaultVisible: false,
		componentPath: "@/components/deprivation/nimdm/NIMDMChart",
		calculateStats: (mm, g, d, l, id) =>
			mm.aggregate(nimdmAggregation, g, d, l, id),
		year: 2017,
	},
	map: deprivationRankMap<NIMDMDataset>("nimdmRank", 890),
};
