import { electricityConsumptionDatasetDefinition } from "@/lib/data/catalog/definitions";
import { electricityConsumptionAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import {
	energyConsumptionValue,
	ENERGY_SECTORS,
} from "@/lib/helpers/energyConsumptionMeasures";
import { formatCompactCount } from "@/lib/helpers/formatCount";
import type {
	AggregatedEnergyConsumptionData,
	ElectricityConsumptionDataset,
	EnergyConsumptionMetrics,
} from "@uk-data-atlas/datasets/types/energyConsumption";
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
			cardForOptions: (options) =>
				defineValueCard<
					ElectricityConsumptionDataset,
					EnergyConsumptionMetrics,
					AggregatedEnergyConsumptionData
				>({
					heading: "Electricity consumption",
					coverage: "Great Britain",
					source: "Department for Energy Security and Net Zero. Subnational electricity consumption. gov.uk",
					unit: "GWh",
					format: formatCompactCount,
					maximum: 4000,
					aggregate: (record) => record,
					value: (record) =>
						record[options.electricityConsumption.sector],
					secondary: () =>
						`${ENERGY_SECTORS.find((sector) => sector.value === options.electricityConsumption.sector)?.label ?? "All meters"} total`,
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
			valueFor: (dataset, code, options) =>
				energyConsumptionValue(
					dataset.data[code],
					options.electricityConsumption.sector,
					options.electricityConsumption.measure,
				),
			sourceMode: (_dataset, options) =>
				`electricityConsumption:${options.electricityConsumption.measure}:${options.electricityConsumption.sector}`,
			colorRange: { min: 0, max: 2_500 },
			legend: {
				min: 0,
				max: 4_000,
				format: (value, mapOptions) =>
					`${formatCompactCount(value)} GWh${mapOptions.electricityConsumption.measure === "perPopulation" ? " per 100k" : ""}`,
			},
		},
	};
