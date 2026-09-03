import { incomeDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { IncomeDataset } from "@/lib/types/income";
import type { ChartDatasetDefinition } from "./types";

export const incomeDefinition: ChartDatasetDefinition<IncomeDataset> = {
	...incomeDatasetDefinition,
	chart: { group: "Economics", key: "economics-income", label: "Income [2025]", defaultVisible: true, componentPath: "@/components/economics/income/IncomeChart", boundaryType: "localAuthority", calculateStats: (m, g, d, l, id) => m.calculateIncomeStats(g, d, l, id), year: 2025 },
	map: { valueFor: (dataset, code) => dataset.data[code]?.annual?.median ?? null, colorRange: { min: 25000, max: 45000 }, legend: { min: 0, max: 80000, format: (v) => `£${v.toFixed(0)}` } },
};
