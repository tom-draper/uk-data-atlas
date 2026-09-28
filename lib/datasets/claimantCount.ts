import { claimantCountDatasetDefinition } from "@/lib/data/catalog/definitions";
import { claimantCountAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type {
	AggregatedClaimantCountData,
	ClaimantCountDataset,
} from "@/lib/types/claimantCount";
import type { ChartDatasetDefinition } from "./types";
import { defineValueCard } from "./valueCard";

export const claimantCountDefinition: ChartDatasetDefinition<ClaimantCountDataset> =
	{
		...claimantCountDatasetDefinition,
		chart: {
			group: "Economics",
			key: "economics-claimantCount",
			label: "Claimant Count [2026]",
			defaultVisible: true,
			componentPath: "@/components/ValueCard",
			card: defineValueCard<
				ClaimantCountDataset,
				AggregatedClaimantCountData
			>({
				heading: "Claimant Count",
				source: "ONS/Nomis. Claimant Count (UC + JSA). nomisweb.co.uk",
				unit: "% of 16-64",
				digits: 1,
				maximum: 10,
				value: (stats) => stats.totalRate,
				secondary: (stats) => `${stats.youthRate.toFixed(1)}% youth`,
			}),
			calculateStats: (m, g, d, l, id) =>
				m.aggregate(claimantCountAggregation, g, d, l, id),
			year: 2026,
		},
		map: {
			valueKey: "totalRate",
			colorRange: { min: 1, max: 8 },
			legend: { min: 0, max: 20, format: (v) => `${v.toFixed(1)}%` },
		},
	};
