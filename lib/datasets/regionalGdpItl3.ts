import { regionalGdpItl3DatasetDefinition } from "@/lib/data/catalog/definitions";
import { regionalGdpItl3Aggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type {
	AggregatedRegionalGdpData,
	RegionalGdpItl3Dataset,
	RegionalGdpMetrics,
} from "@uk-data-atlas/datasets/types/regionalGdp";
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
				coverage: "United Kingdom",
				source: "Office for National Statistics. Regional gross domestic product. ons.gov.uk",
				format: formatGdp,
				maximum: 210_000,
				aggregate: (aggregate) => aggregate,
				value: (record) => record.gdpMillionGbp,
				secondary: (record) => `${formatGdp(record.gvaMillionGbp)} GVA`,
			}),
			cardForOptions: (options) =>
				defineValueCard<
					RegionalGdpItl3Dataset,
					RegionalGdpMetrics,
					AggregatedRegionalGdpData
				>({
					heading:
						options.regionalGdpItl3.measure === "gva"
							? "Regional GVA"
							: "Regional GDP",
					coverage: "United Kingdom",
					source: "Office for National Statistics. Regional gross domestic product and gross value added. ons.gov.uk",
					format: formatGdp,
					maximum: 210_000,
					aggregate: (aggregate) => aggregate,
					value: (record) =>
						options.regionalGdpItl3.measure === "gva"
							? record.gvaMillionGbp
							: record.gdpMillionGbp,
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
			valueFor: (dataset, code, options) =>
				(options.regionalGdpItl3.measure === "gva"
					? dataset.data[code]?.gvaMillionGbp
					: dataset.data[code]?.gdpMillionGbp) ?? null,
			sourceMode: (_dataset, options) =>
				`regional-output:${options.regionalGdpItl3.measure}`,
			colorRange: { min: 0, max: 50_000 },
			legend: {
				min: 0,
				max: 210_000,
				format: (value, options) =>
					`${formatGdp(value)} ${options.regionalGdpItl3.measure.toUpperCase()}`,
			},
		},
	};
