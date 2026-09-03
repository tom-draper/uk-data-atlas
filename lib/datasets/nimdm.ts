import { nimdmDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { NIMDMDataset } from "@/lib/types/nimdm";
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
			mm.calculateNIMDMStats(g, d, l, id),
		year: 2017,
	},
	map: {
		valueKey: "nimdmRank",
		colorRange: { min: 1, max: 890 },
		legend: {
			min: 1,
			max: 890,
			format: (value) => {
				const rank = 891 - value;
				return rank <= 1
					? "Most deprived"
					: rank >= 890
						? "Least deprived"
						: `Rank ${Math.round(rank).toLocaleString()}`;
			},
		},
		invertColor: false,
	},
};
