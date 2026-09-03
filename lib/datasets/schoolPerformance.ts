import { schoolPerformanceDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { SchoolPerformanceDataset } from "@/lib/types/schoolPerformance";
import type { ChartDatasetDefinition } from "./types";

export const schoolPerformanceDefinition: ChartDatasetDefinition<SchoolPerformanceDataset> = {
	...schoolPerformanceDatasetDefinition,
	chart: { group: "Education", key: "education-schoolPerformance", label: "School Performance [2024]", defaultVisible: true, componentPath: "@/components/education/SchoolPerformanceChart", calculateStats: (m, g, d, l, id) => m.calculateSchoolPerformanceStats(g, d, l, id), year: 2024 },
	map: { valueKey: "ptL2basics94", colorRange: { min: 50, max: 80 }, legend: { min: 0, max: 100, format: (v) => `${v.toFixed(0)}% grade 4+` } },
};
