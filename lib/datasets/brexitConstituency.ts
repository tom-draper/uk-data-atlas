import { renderBrexitConstituency } from "@/lib/helpers/mapRendering";
import { brexitConstituencyAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import { definitionOf, brexitConstituency } from "@uk-data-atlas/datasets";
import type { BrexitConstituencyDataset } from "@uk-data-atlas/datasets";
import type { ChartDatasetDefinition } from "./types";

export const brexitConstituencyDefinition: ChartDatasetDefinition<BrexitConstituencyDataset> =
	{
		...definitionOf(brexitConstituency),
		chart: {
			topic: "referendums",
			key: "brexit-hanretty",
			label: "Hanretty Estimates [2016]",
			componentPath:
				"@/components/elections/referendum/BrexitHanrettyEstimatesChart",
			calculateStats: (mm, g, d, l, id) =>
				mm.aggregate(brexitConstituencyAggregation, g, d, l, id),
			year: 2016,
		},
		legendKind: "brexit",
		mapRenderer: {
			getOptions: (_activeViz, mapOptions) =>
				mapOptions["brexit-constituency"],
			render: ({ map, geojson, dataset, mapOptions }) =>
				renderBrexitConstituency(map, geojson, dataset, mapOptions),
		},
	};
