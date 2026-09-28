import { schoolPerformanceDisadvantageDatasetDefinition } from "@/lib/data/catalog/definitions";
import { schoolPerformanceGapAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type {
	AggregatedSchoolPerformanceGapData,
	SchoolPerformanceGapDataset,
} from "@/lib/types/schoolPerformance";
import type { ChartDatasetDefinition } from "./types";
import { defineValueCard } from "./valueCard";

export const schoolPerformanceDisadvantageDefinition: ChartDatasetDefinition<SchoolPerformanceGapDataset> =
	{
		...schoolPerformanceDisadvantageDatasetDefinition,
		chart: {
			group: "Education",
			key: "education-schoolPerformanceGap",
			label: "Attainment 8 Gap [2024/25]",
			defaultVisible: false,
			componentPath: "@/components/ValueCard",
			card: defineValueCard<
				SchoolPerformanceGapDataset,
				AggregatedSchoolPerformanceGapData
			>({
				heading: "Attainment 8 Gap",
				period: "2024/25",
				coverage: "England",
				source: "Department for Education. Key Stage 4 Performance 2024/25. Difference in average Attainment 8 between pupils not known to be disadvantaged and disadvantaged pupils.",
				unit: "pts behind",
				digits: 1,
				// Roughly the widest gap in England, so the bar spans the real spread.
				maximum: 30,
				value: (stats) => stats.att8Gap,
				secondary: (stats) =>
					stats.att8Disadvantaged != null &&
					stats.att8NotDisadvantaged != null
						? `${stats.att8Disadvantaged.toFixed(1)} vs ${stats.att8NotDisadvantaged.toFixed(1)}`
						: undefined,
			}),
			calculateStats: (m, g, d, l, id) =>
				m.aggregate(schoolPerformanceGapAggregation, g, d, l, id),
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
