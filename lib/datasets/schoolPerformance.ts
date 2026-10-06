import { schoolPerformanceDatasetDefinition } from "@/lib/data/catalog/definitions";
import { schoolPerformanceAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type {
	AggregatedSchoolPerformanceData,
	SchoolPerformanceDataset,
} from "@/lib/types/schoolPerformance";
import type { ChartDatasetDefinition } from "./types";
import { defineValueCard } from "./valueCard";

export const schoolPerformanceDefinition: ChartDatasetDefinition<SchoolPerformanceDataset> =
	{
		...schoolPerformanceDatasetDefinition,
		chart: {
			group: "Education",
			key: "education-schoolPerformance",
			label: "GCSE Performance [2024/25]",
			defaultVisible: true,
			componentPath: "@/components/education/SchoolPerformanceChart",
			card: defineValueCard<
				SchoolPerformanceDataset,
				AggregatedSchoolPerformanceData
			>({
				heading: "GCSE Performance",
				period: "2024/25",
				coverage: "England",
				source: "Department for Education. Key Stage 4 Performance 2024/25. explore-education-statistics.service.gov.uk",
				unit: "% grade 4+",
				digits: 1,
				maximum: 100,
				value: (stats) => stats.ptL2basics94,
				secondary: (stats) =>
					stats.ptL2basics95 != null
						? `${stats.ptL2basics95.toFixed(1)}% grade 5+`
						: undefined,
			}),
			calculateStats: (m, g, d, l, id) =>
				m.aggregate(schoolPerformanceAggregation, g, d, l, id),
			year: 2025,
		},
		map: {
			valueFor: (dataset, code, mapOptions) => {
				const area = dataset.data[code];
				switch (mapOptions.schoolPerformance.measure) {
					case "grade5":
						return area?.ptL2basics95 ?? null;
					case "attainment8":
						return area?.avgAtt8 ?? null;
					case "progress8":
						return area?.avgP8score ?? null;
					default:
						return area?.ptL2basics94 ?? null;
				}
			},
			sourceMode: (_dataset, mapOptions) =>
				`schoolPerformance:${mapOptions.schoolPerformance.measure}`,
			colorRange: { min: 50, max: 80 },
			legend: {
				min: 0,
				max: 100,
				format: (v) => `${v.toFixed(0)}% grade 4+`,
			},
		},
	};
