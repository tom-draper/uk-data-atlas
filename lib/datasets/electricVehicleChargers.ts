import { electricVehicleChargersDatasetDefinition } from "@/lib/data/catalog/definitions";
import { indicatorAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { IndicatorDataset } from "@/lib/types/indicator";
import { indicatorCard } from "./indicatorCard";
import type { ChartDatasetDefinition } from "./types";
export const electricVehicleChargersDefinition: ChartDatasetDefinition<
	IndicatorDataset<"electricVehicleChargers">
> = {
	...electricVehicleChargersDatasetDefinition,
	chart: {
		group: "Transport",
		key: "transport-electricVehicleChargers",
		label: "Public EV Chargers [2026]",
		defaultVisible: true,
		componentPath: "@/components/ValueCard",
		card: indicatorCard({
			heading: "Public EV chargers",
			unit: "chargers",
			maximum: 5_000,
		}),
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(indicatorAggregation, g, d, l, id),
		year: 2026,
	},
	map: {
		valueKey: "value",
		colorRange: { min: 0, max: 1_500 },
		legend: {
			min: 0,
			max: 5_000,
			format: (v) => v.toLocaleString("en-GB"),
		},
	},
};
