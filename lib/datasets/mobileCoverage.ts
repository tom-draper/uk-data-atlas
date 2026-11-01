import { MOBILE_COVERAGE_MEASURES } from "@/lib/helpers/mobileCoverageMeasures";
import { mobileCoverageDatasetDefinition } from "@/lib/data/catalog/definitions";
import { mobileCoverageAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { MobileCoverageDataset } from "@uk-data-atlas/datasets/types/mobileCoverage";
import type { ChartDatasetDefinition } from "./types";

export const mobileCoverageDefinition: ChartDatasetDefinition<MobileCoverageDataset> =
	{
		...mobileCoverageDatasetDefinition,
		chart: {
			group: "Telecoms",
			key: "telecoms-mobileCoverage",
			label: "Mobile Coverage [2025]",
			defaultVisible: true,
			componentPath: "@/components/telecoms/mobile/MobileCoverageChart",
			calculateStats: (aggregator, geojson, data, location, datasetId) =>
				aggregator.aggregate(
					mobileCoverageAggregation,
					geojson,
					data,
					location,
					datasetId,
				),
			year: 2025,
		},
		map: {
			valueFor: (dataset, code, options) =>
				dataset.data[code]?.[options.mobileCoverage.measure] ?? null,
			sourceMode: (_dataset, options) =>
				`mobile:${options.mobileCoverage.measure}`,
			colorRange: { min: 5, max: 75 },
			legend: {
				min: 0,
				max: 100,
				format: (value, options) =>
					`${value.toFixed(0)}% ${MOBILE_COVERAGE_MEASURES.find(({ value }) => value === options.mobileCoverage.measure)?.label}`,
			},
		},
	};
