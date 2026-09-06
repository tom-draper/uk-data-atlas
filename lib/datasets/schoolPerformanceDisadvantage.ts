import { schoolPerformanceDisadvantageDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { SchoolPerformanceGapDataset } from "@/lib/types/schoolPerformance";
import type { ChartDatasetDefinition } from "./types";

export const schoolPerformanceDisadvantageDefinition: ChartDatasetDefinition<SchoolPerformanceGapDataset> =
	{
		...schoolPerformanceDisadvantageDatasetDefinition,
		chart: {
			group: "Education",
			key: "education-schoolPerformanceGap",
			label: "Attainment 8 Disadvantage Gap [2024/25]",
			defaultVisible: false,
			componentPath:
				"@/components/education/SchoolPerformanceDisadvantageChart",
			calculateStats: (m, g, d, l, id) =>
				m.calculateSchoolPerformanceGapStats(g, d, l, id),
			year: 2025,
		},
		map: {
			valueKey: "att8Gap",
			// England's districts run from about six points to about twenty-nine.
			colorRange: { min: 10, max: 25 },
			legend: {
				min: 0,
				max: 35,
				format: (v) => `${v.toFixed(0)} pts behind`,
			},
		},
	};
