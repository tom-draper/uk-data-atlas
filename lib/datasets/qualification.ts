import { qualificationDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { QualificationDataset } from "@/lib/types/qualification";
import type { ChartDatasetDefinition } from "./types";

export const qualificationDefinition: ChartDatasetDefinition<QualificationDataset> =
	{
		...qualificationDatasetDefinition,
		chart: {
			group: "Education",
			key: "education-qualifications",
			label: "Qualifications [2021]",
			defaultVisible: true,
			componentPath: "@/components/education/QualificationChart",
			calculateStats: (mm, g, d, l, id) =>
				mm.calculateQualificationStats(g, d, l, id),
			year: 2021,
		},
		map: {
			valueFor: (dataset, code) => {
				const area = dataset.data[code];
				return area && area.breakdown.total > 0
					? (area.breakdown.level4Plus / area.breakdown.total) * 100
					: null;
			},
			colorRange: { min: 25, max: 60 },
			legend: { min: 25, max: 60, format: String },
		},
	};
