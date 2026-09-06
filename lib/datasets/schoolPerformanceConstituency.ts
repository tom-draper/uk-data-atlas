import { schoolPerformanceConstituencyDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { SchoolPerformanceConstituencyDataset } from "@/lib/types/schoolPerformance";
import type { ChartDatasetDefinition } from "./types";

export const schoolPerformanceConstituencyDefinition: ChartDatasetDefinition<SchoolPerformanceConstituencyDataset> =
	{
		...schoolPerformanceConstituencyDatasetDefinition,
		chart: {
			group: "Education",
			key: "education-schoolPerformanceConstituency",
			label: "School Performance by Constituency [2024/25]",
			defaultVisible: false,
			componentPath:
				"@/components/education/SchoolPerformanceConstituencyChart",
			calculateStats: (m, g, d, l, id) =>
				m.calculateSchoolPerformanceConstituencyStats(g, d, l, id),
			year: 2025,
		},
		map: {
			valueKey: "ptL2basics94",
			colorRange: { min: 50, max: 80 },
			legend: {
				min: 0,
				max: 100,
				format: (v) => `${v.toFixed(0)}% grade 4+`,
			},
		},
	};
