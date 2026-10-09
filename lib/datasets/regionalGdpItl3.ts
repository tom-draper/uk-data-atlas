import { regionalGdpItl3DatasetDefinition } from "@/lib/data/catalog/definitions";
import { regionalGdpItl3Aggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type {
	AggregatedRegionalGdpData,
	RegionalGdpItl3Dataset,
	RegionalGdpMetrics,
} from "@/lib/types/regionalGdp";
import type { ChartDatasetDefinition } from "./types";
import { defineValueCard } from "./valueCard";

const formatGdp = (value: number) =>
	value >= 1_000
		? `£${(value / 1_000).toFixed(1)}bn`
		: `£${value.toFixed(0)}m`;

export const regionalGdpItl3Definition: ChartDatasetDefinition<RegionalGdpItl3Dataset> =
	{
		...regionalGdpItl3DatasetDefinition,
		chart: {
			group: "Economics",
			key: "economics-regionalGdpItl3",
			label: "Regional GDP [2023]",
			defaultVisible: true,
			componentPath: "@/components/ValueCard",
			card: defineValueCard<
				RegionalGdpItl3Dataset,
				RegionalGdpMetrics,
				AggregatedRegionalGdpData
			>({
				heading: "Regional GDP",
				coverage: "UK",
				source: "Office for National Statistics. Regional gross domestic product. ons.gov.uk",
				format: formatGdp,
				maximum: 210_000,
				aggregate: (aggregate) => aggregate,
				value: (record) => record.gdpMillionGbp,
				secondary: (record) => `${formatGdp(record.gvaMillionGbp)} GVA`,
			}),
			calculateStats: (aggregator, geojson, data, location, datasetId) =>
				aggregator.aggregate(
					regionalGdpItl3Aggregation,
					geojson,
					data,
					location,
					datasetId,
				),
			year: 2023,
		},
		map: {
			valueKey: "gdpMillionGbp",
			colorRange: { min: 0, max: 50_000 },
			legend: { min: 0, max: 210_000, format: formatGdp },
		},
	};
