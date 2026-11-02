import { incomeDatasetDefinition } from "@/lib/data/catalog/definitions";
import { incomeAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { IncomeDataset } from "@uk-data-atlas/datasets/types/income";
import type { ChartDatasetDefinition } from "./types";

export const incomeDefinition: ChartDatasetDefinition<IncomeDataset> = {
	...incomeDatasetDefinition,
	chart: {
		group: "Economics",
		key: "economics-income",
		label: "Income [2025]",
		defaultVisible: true,
		componentPath: "@/components/economics/income/IncomeChart",
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(incomeAggregation, g, d, l, id),
		year: 2025,
	},
	map: {
		valueFor: (dataset, code, mapOptions) => {
			const annual = dataset.data[code]?.[mapOptions.income.period];
			return mapOptions.income.measure === "mean"
				? (annual?.mean ?? null)
				: (annual?.median ?? null);
		},
		sourceMode: (_dataset, mapOptions) =>
			`income:${mapOptions.income.measure}:${mapOptions.income.period}`,
		colorRange: { min: 25000, max: 45000 },
		legend: {
			min: 0,
			max: 80000,
			bounds: (options) => ({
				min: 0,
				max: options.income.period === "hourly" ? 60 : 80000,
			}),
			format: (v, options) =>
				`£${v.toFixed(options.income.period === "hourly" ? 2 : 0)}${options.income.period === "hourly" ? "/hour" : ""}`,
		},
	},
};
