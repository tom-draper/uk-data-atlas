import { jobsDatasetDefinition } from "@/lib/data/catalog/definitions";
import { jobsAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import { formatCompactCount } from "@/lib/helpers/formatCount";
import type {
	AggregatedJobsData,
	JobsDataset,
	JobsLADData,
} from "@/lib/types/jobs";
import type { ChartDatasetDefinition } from "./types";
import { defineValueCard } from "./valueCard";

export const jobsDefinition: ChartDatasetDefinition<JobsDataset> = {
	...jobsDatasetDefinition,
	chart: {
		group: "Economics",
		key: "economics-jobs",
		label: "Jobs [2024]",
		defaultVisible: true,
		componentPath: "@/components/ValueCard",
		card: defineValueCard<JobsDataset, JobsLADData, AggregatedJobsData>({
			heading: "Jobs",
			coverage: "UK",
			source: "Office for National Statistics. Jobs. nomisweb.co.uk",
			unit: "jobs",
			format: formatCompactCount,
			maximum: 1_000_000,
			value: (record) => record.totalJobs,
		}),
		calculateStats: (aggregator, geojson, data, location, datasetId) =>
			aggregator.aggregate(
				jobsAggregation,
				geojson,
				data,
				location,
				datasetId,
			),
		year: 2024,
	},
	map: {
		valueKey: "totalJobs",
		colorRange: { min: 0, max: 500_000 },
		legend: { min: 0, max: 1_000_000, format: formatCompactCount },
	},
};
