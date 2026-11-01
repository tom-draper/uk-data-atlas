import { gasConsumptionDatasetDefinition } from "@/lib/data/catalog/definitions";
import { gasConsumptionAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import {
	energyConsumptionValue,
	ENERGY_SECTORS,
} from "@/lib/helpers/energyConsumptionMeasures";
import { formatCompactCount } from "@/lib/helpers/formatCount";
import type {
	AggregatedEnergyConsumptionData,
	EnergyConsumptionMetrics,
	GasConsumptionDataset,
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
			cardForOptions: (options) =>
				defineValueCard<
					GasConsumptionDataset,
					EnergyConsumptionMetrics,
					AggregatedEnergyConsumptionData
				>({
					heading: "Gas consumption",
					coverage: "Great Britain",
					source: "Department for Energy Security and Net Zero. Subnational gas consumption. gov.uk",
					unit: "GWh",
					format: formatCompactCount,
					maximum: 8000,
					aggregate: (record) => record,
					value: (record) => record[options.gasConsumption.sector],
					secondary: () =>
						`${ENERGY_SECTORS.find((sector) => sector.value === options.gasConsumption.sector)?.label ?? "All meters"} total`,
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
			valueFor: (dataset, code, options) =>
				energyConsumptionValue(
					dataset.data[code],
					options.gasConsumption.sector,
					options.gasConsumption.measure,
				),
			sourceMode: (_dataset, options) =>
				`gasConsumption:${options.gasConsumption.measure}:${options.gasConsumption.sector}`,
			colorRange: { min: 0, max: 5_000 },
			legend: {
				min: 0,
				max: 8_000,
				format: (value, mapOptions) =>
					`${formatCompactCount(value)} GWh${mapOptions.gasConsumption.measure === "perPopulation" ? " per 100k" : ""}`,
			},
		},
	};
