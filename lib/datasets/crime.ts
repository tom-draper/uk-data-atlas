import { crimeDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { CrimeDataset } from "@/lib/types/crime";
import type { ChartDatasetDefinition } from "./types";

export const crimeDefinition: ChartDatasetDefinition<CrimeDataset> = {
	...crimeDatasetDefinition,
	chart: { group: "Economics", key: "economics-crime", label: "Crime Rate [2025]", defaultVisible: true, componentPath: "@/components/economics/crime/CrimeRateChart", calculateStats: (m, g, d, l, id) => m.calculateCrimeStats(g, d, l, id), year: 2025 },
	map: { valueKey: "totalRecordedCrime", colorRange: { min: 10000, max: 100000 }, legend: { min: 0, max: 150000, format: (v) => v.toFixed(0) } },
};
