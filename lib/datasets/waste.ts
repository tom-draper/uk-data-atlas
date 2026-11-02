import { wasteDatasetDefinition } from "@/lib/data/catalog/definitions";
import { wasteAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import { wasteValue, type WasteStats } from "@/lib/helpers/waste";
import type { IndicatorDataset } from "@uk-data-atlas/datasets/types/indicator";
import type { WasteOptions } from "@/lib/types/mapOptions";
import { defineValueCard } from "./valueCard";
import type { ChartDatasetDefinition } from "./types";

export const wasteCard = (options: WasteOptions) =>
	defineValueCard<IndicatorDataset<"waste">, WasteStats, WasteStats>({
		heading:
			options.metric === "recyclingShare"
				? "Recycling share"
				: options.metric === "recycled"
					? "Recycled waste"
					: "Collected waste",
		period: "2024/25",
		coverage: "England",
		source: "Defra. Local-authority collected waste, 2024/25. Recycling includes composting and reuse. gov.uk",
		unit:
			options.metric === "recyclingShare"
				? "% recycled"
				: options.measure === "perPopulation"
					? "tonnes per 100k"
					: "tonnes",
		digits: options.metric === "recyclingShare" ? 1 : 0,
		maximum:
			options.metric === "recyclingShare"
				? 100
				: options.measure === "perPopulation"
					? 60_000
					: 500_000,
		value: (record) => wasteValue(record, options),
		secondary: () =>
			options.metric === "collected"
				? undefined
				: "Includes composting and reuse",
	});

export const wasteDefinition: ChartDatasetDefinition<
	IndicatorDataset<"waste">
> = {
	...wasteDatasetDefinition,
	chart: {
		group: "Environment",
		key: "environment-waste",
		label: "Collected Waste [2025]",
		defaultVisible: true,
		componentPath: "@/components/environment/waste/WasteChart",
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(wasteAggregation, g, d, l, id),
		year: 2025,
	},
	map: {
		valueFor: (dataset, code, options) =>
			wasteValue(dataset.data[code], options.waste),
		sourceMode: (_dataset, options) =>
			`waste:${options.waste.metric}:${options.waste.measure}`,
		colorRange: { min: 0, max: 200_000 },
		legend: {
			min: 0,
			max: 500_000,
			format: (v, options) =>
				options.waste.metric === "recyclingShare"
					? `${v.toFixed(1)}% recycled`
					: `${v.toLocaleString("en-GB")} t${options.waste.measure === "perPopulation" ? " per 100k" : ""}`,
		},
	},
};
