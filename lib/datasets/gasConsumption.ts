import { gasConsumptionDatasetDefinition } from "@/lib/data/catalog/definitions";
import { gasConsumptionAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import { formatCompactCount } from "@/lib/helpers/formatCount";
import type {
	AggregatedEnergyConsumptionData,
	EnergyConsumptionMetrics,
	GasConsumptionDataset,
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

export const gasConsumptionDefinition: ChartDatasetDefinition<GasConsumptionDataset> =
	{
		...gasConsumptionDatasetDefinition,
		chart: {
			group: "Environment",
			key: "environment-gasConsumption",
			label: "Gas Consumption [2024]",
			defaultVisible: true,
			componentPath: "@/components/ValueCard",
			card: defineValueCard<
				GasConsumptionDataset,
				EnergyConsumptionMetrics,
				AggregatedEnergyConsumptionData
			>({
				heading: "Gas consumption",
				coverage: "Great Britain",
				source: "Department for Energy Security and Net Zero. Subnational gas consumption. gov.uk",
				unit: "GWh",
				format: formatCompactCount,
				maximum: 8_000,
				aggregate: (aggregate) => aggregate,
				value: (record) => record.allMetersGwh,
				secondary: domesticShare,
			}),
			calculateStats: (aggregator, geojson, data, location, datasetId) =>
				aggregator.aggregate(
					gasConsumptionAggregation,
					geojson,
					data,
					location,
					datasetId,
				),
			year: 2024,
		},
		map: {
			valueKey: "allMetersGwh",
			colorRange: { min: 0, max: 5_000 },
			legend: {
				min: 0,
				max: 8_000,
				format: (value) => `${formatCompactCount(value)} GWh`,
			},
		},
	};
