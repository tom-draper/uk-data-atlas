import { simdDatasetDefinition } from "@/lib/data/catalog/definitions";
import { simdAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { SIMDDataset } from "@/lib/types/simd";
import { deprivationRankMap } from "./deprivationRankMap";
import type { ChartDatasetDefinition } from "./types";

export const simdDefinition: ChartDatasetDefinition<SIMDDataset> = {
	...simdDatasetDefinition,
	chart: {
		group: "Deprivation",
		key: "deprivation-simd",
		label: "Deprivation (SIMD) [2020]",
		defaultVisible: false,
		componentPath: "@/components/deprivation/simd/SIMDChart",
		calculateStats: (mm, g, d, l, id) =>
			mm.aggregate(simdAggregation, g, d, l, id),
		year: 2020,
	},
	map: deprivationRankMap<SIMDDataset>("simdRank", 6976),
};
