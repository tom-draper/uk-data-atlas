import { broadbandDatasetDefinition } from "@/lib/data/catalog/definitions";
import { broadbandAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { BroadbandDataset } from "@/lib/types/broadband";
import type { ChartDatasetDefinition } from "./types";

export const broadbandDefinition: ChartDatasetDefinition<BroadbandDataset> = {
	...broadbandDatasetDefinition,
	chart: {
		group: "Telecoms",
		key: "telecoms-broadband",
		label: "Fixed Broadband Coverage [2025]",
		defaultVisible: true,
		componentPath: "@/components/telecoms/broadband/BroadbandChart",
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(broadbandAggregation, g, d, l, id),
		year: 2025,
	},
	map: {
		valueFor: (dataset, code, mapOptions) => {
			const area = dataset.data[code];
			switch (mapOptions.broadband.measure) {
				case "superfast":
					return area?.pctSuperfast ?? null;
				case "ultrafast":
					return area?.pctUltrafast ?? null;
				case "gigabit":
					return area?.pctGigabit ?? null;
				default:
					return area?.pctFullFibre ?? null;
			}
		},
		sourceMode: (_dataset, mapOptions) =>
			`broadband:${mapOptions.broadband.measure}`,
		colorRange: { min: 50, max: 100 },
		legend: {
			min: 0,
			max: 100,
			format: (v) => `${v.toFixed(0)}% full fibre`,
		},
	},
};
