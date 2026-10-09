import { electricityConsumptionDatasetDefinition } from "@/lib/data/catalog/definitions";
import { electricityConsumptionAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import { formatCompactCount } from "@/lib/helpers/formatCount";
import type {
	AggregatedEnergyConsumptionData,
	ElectricityConsumptionDataset,
	EnergyConsumptionMetrics,
} from "@/lib/types/energyConsumption";
import type { ChartDatasetDefinition } from "./types";
import { defineValueCard } from "./valueCard";

const domesticShare = ({
	domesticGwh,
	allMetersGwh,
}: EnergyConsumptionMetrics) =>
	allMetersGwh > 0
		? `${((domesticGwh / allMetersGwh) * 100).toFixed(0)}% domestic`
		: undefined;

export const electricityConsumptionDefinition: ChartDatasetDefinition<ElectricityConsumptionDataset> =
	{
		...electricityConsumptionDatasetDefinition,
		chart: {
			group: "Environment",
			key: "environment-electricityConsumption",
			label: "Electricity Consumption [2024]",
			defaultVisible: true,
			componentPath: "@/components/ValueCard",
			card: defineValueCard<
				ElectricityConsumptionDataset,
				EnergyConsumptionMetrics,
				AggregatedEnergyConsumptionData
			>({
				heading: "Electricity consumption",
				coverage: "Great Britain",
				source: "Department for Energy Security and Net Zero. Subnational electricity consumption. gov.uk",
				unit: "GWh",
				format: formatCompactCount,
				maximum: 4_000,
				aggregate: (aggregate) => aggregate,
				value: (record) => record.allMetersGwh,
				secondary: domesticShare,
			}),
			calculateStats: (aggregator, geojson, data, location, datasetId) =>
				aggregator.aggregate(
					electricityConsumptionAggregation,
					geojson,
					data,
					location,
					datasetId,
				),
			year: 2024,
		},
		map: {
			valueKey: "allMetersGwh",
			colorRange: { min: 0, max: 2_500 },
			legend: {
				min: 0,
				max: 4_000,
				format: (value) => `${formatCompactCount(value)} GWh`,
			},
		},
	};
