import { incomeDatasetDefinition } from "@/lib/data/catalog/definitions";
import { incomeAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { IncomeDataset } from "@/lib/types/income";
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
			const annual = dataset.data[code]?.annual;
			return mapOptions.income.measure === "mean"
				? (annual?.mean ?? null)
				: (annual?.median ?? null);
		},
		sourceMode: (_dataset, mapOptions) =>
			`income:${mapOptions.income.measure}`,
		colorRange: { min: 25000, max: 45000 },
		legend: { min: 0, max: 80000, format: (v) => `£${v.toFixed(0)}` },
	},
};
