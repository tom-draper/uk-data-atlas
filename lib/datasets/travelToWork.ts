import { travelToWorkDatasetDefinition } from "@/lib/data/catalog/definitions";
import { travelToWorkAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { TravelToWorkDataset } from "@/lib/types/travelToWork";
import type { ChartDatasetDefinition } from "./types";

export const travelToWorkDefinition: ChartDatasetDefinition<TravelToWorkDataset> =
	{
		...travelToWorkDatasetDefinition,
		chart: {
			group: "Transport",
			key: "transport-travelToWork",
			label: "Travel to Work [2021]",
			defaultVisible: true,
			componentPath:
				"@/components/transport/travel-to-work/TravelToWorkChart",
			calculateStats: (mm, g, d, l, id) =>
				mm.aggregate(travelToWorkAggregation, g, d, l, id),
			year: 2021,
		},
		map: {
			// Car share: the widest spread of any mode, and the one that reads
			// as the urban-rural gradient people expect from a commuting map.
			valueFor: (dataset, code) => {
				const area = dataset.data[code];
				return area && area.breakdown.total > 0
					? (area.breakdown.car / area.breakdown.total) * 100
					: null;
			},
			colorRange: { min: 25, max: 70 },
			legend: {
				min: 0,
				max: 80,
				format: (value) => `${value.toFixed(0)}%`,
			},
		},
	};
