import { carAvailabilityDatasetDefinition } from "@/lib/data/catalog/definitions";
import { carAvailabilityAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { CarAvailabilityDataset } from "@/lib/types/carAvailability";
import type { ChartDatasetDefinition } from "./types";

export const carAvailabilityDefinition: ChartDatasetDefinition<CarAvailabilityDataset> =
	{
		...carAvailabilityDatasetDefinition,
		chart: {
			group: "Transport",
			key: "transport-carAvailability",
			label: "Car Availability [2021]",
			defaultVisible: true,
			componentPath:
				"@/components/transport/car-availability/CarAvailabilityChart",
			calculateStats: (mm, g, d, l, id) =>
				mm.aggregate(carAvailabilityAggregation, g, d, l, id),
			year: 2021,
		},
		map: {
			// Households with no car: the measure with the most spread, and the
			// one that reads as car dependency rather than as affluence.
			valueFor: (dataset, code) => {
				const area = dataset.data[code];
				return area && area.breakdown.total > 0
					? (area.breakdown.noCar / area.breakdown.total) * 100
					: null;
			},
			colorRange: { min: 8, max: 50 },
			legend: {
				min: 0,
				max: 80,
				format: (value) => `${value.toFixed(0)}%`,
			},
		},
	};
