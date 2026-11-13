import { renderGeneralElection } from "@/lib/helpers/mapRendering";
import { generalElectionAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import { definitionOf, generalElection } from "@uk-data-atlas/datasets";
import type { GeneralElectionDataset } from "@uk-data-atlas/datasets";
import type { ChartDatasetDefinition, ChartDefinition } from "./types";

const calculateStats: ChartDefinition<GeneralElectionDataset>["calculateStats"] =
	(mapManager, geojson, data, location, datasetId) =>
		mapManager.aggregate(
			generalElectionAggregation,
			geojson,
			data,
			location,
			datasetId,
		);

const chart2024: ChartDefinition<GeneralElectionDataset> = {
	topic: "general-elections",
	key: "generalElection-2024",
	label: "2024 General Election",
	componentPath:
		"@/components/elections/general/GeneralElectionRegistryChart",
	calculateStats,
	year: 2024,
};
const chart2019: ChartDefinition<GeneralElectionDataset> = {
	topic: "general-elections",
	key: "generalElection-2019",
	label: "2019 General Election",
	componentPath:
		"@/components/elections/general/GeneralElectionRegistryChart",
	calculateStats,
	year: 2019,
};
const chart2017: ChartDefinition<GeneralElectionDataset> = {
	topic: "general-elections",
	key: "generalElection-2017",
	label: "2017 General Election",
	componentPath:
		"@/components/elections/general/GeneralElectionRegistryChart",
	calculateStats,
	year: 2017,
};
const chart2015: ChartDefinition<GeneralElectionDataset> = {
	topic: "general-elections",
	key: "generalElection-2015",
	label: "2015 General Election",
	componentPath:
		"@/components/elections/general/GeneralElectionRegistryChart",
	calculateStats,
	year: 2015,
};
const chart2010: ChartDefinition<GeneralElectionDataset> = {
	topic: "general-elections",
	key: "generalElection-2010",
	label: "2010 General Election",
	componentPath:
		"@/components/elections/general/GeneralElectionRegistryChart",
	calculateStats,
	year: 2010,
};
export const generalElectionDefinition: ChartDatasetDefinition<GeneralElectionDataset> =
	{
		...definitionOf(generalElection),
		chart: chart2024,
		charts: [chart2024, chart2019, chart2017, chart2015, chart2010],
		legendAggregation: { calculateStats },
		legendKind: "party",
		mapRenderer: {
			getOptions: (_activeViz, mapOptions) =>
				mapOptions["general-election"],
			render: ({ map, geojson, dataset, mapOptions, isDark }) =>
				renderGeneralElection(
					map,
					geojson,
					dataset,
					mapOptions,
					isDark,
				),
		},
	};
