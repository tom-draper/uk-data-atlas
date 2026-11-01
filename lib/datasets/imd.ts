import { imdDatasetDefinition } from "@/lib/data/catalog/definitions";
import { imdRange } from "@/lib/helpers/imdMeasures";
import { imdAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { IMDDataset } from "@uk-data-atlas/datasets/types/imd";
import type { ChartDatasetDefinition } from "./types";

export const imdDefinition: ChartDatasetDefinition<IMDDataset> = {
	...imdDatasetDefinition,
	chart: {
		group: "Deprivation",
		key: "deprivation-imd",
		label: "Deprivation (IMD) [2025]",
		defaultVisible: true,
		componentPath: "@/components/deprivation/imd/IMDChart",
		calculateStats: (mm, g, d, l, id) =>
			mm.aggregate(imdAggregation, g, d, l, id),
		year: 2025,
	},
	map: {
		valueFor: (dataset, code, options) =>
			dataset.data[code]?.[options.imd.measure] ?? null,
		sourceMode: (_dataset, options) => `imd:${options.imd.measure}`,
		colorRange: { min: 1, max: 70 },
		legend: {
			min: 0,
			max: 100,
			bounds: (options) => imdRange(options.imd.measure),
			format: (value, options) =>
				options.imd.measure === "incomeScore" ||
				options.imd.measure === "employmentScore"
					? value.toFixed(3)
					: value.toFixed(1),
		},
	},
};
