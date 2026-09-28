import { mobileCoverageDatasetDefinition } from "@/lib/data/catalog/definitions";
import { mobileCoverageAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { MobileCoverageDataset } from "@/lib/types/mobileCoverage";
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
			// 5G from all four operators, the one measure with real spread:
			// indoor 4G from at least one is above 94% almost everywhere.
			valueKey: "pct5GOutdoorAll",
			colorRange: { min: 5, max: 75 },
			legend: {
				min: 0,
				max: 100,
				format: (value) => `${value.toFixed(0)}%`,
			},
		},
	};
