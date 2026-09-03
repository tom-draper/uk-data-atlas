import { generalElectionDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { GeneralElectionDataset } from "@/lib/types/elections";
import type { ChartDatasetDefinition, ChartDefinition } from "./types";

const calculateStats: ChartDefinition<GeneralElectionDataset>["calculateStats"] =
	(mapManager, geojson, data, location, datasetId) =>
		mapManager.calculateGeneralElectionStats(geojson, data, location, datasetId);

const chart2024: ChartDefinition<GeneralElectionDataset> = { group: "General Election", key: "generalElection-2024", label: "2024 General Election", defaultVisible: true, componentPath: "@/components/elections/general/GeneralElectionRegistryChart", calculateStats, year: 2024 };
const chart2019: ChartDefinition<GeneralElectionDataset> = { group: "General Election", key: "generalElection-2019", label: "2019 General Election", defaultVisible: true, componentPath: "@/components/elections/general/GeneralElectionRegistryChart", calculateStats, year: 2019 };
const chart2017: ChartDefinition<GeneralElectionDataset> = { group: "General Election", key: "generalElection-2017", label: "2017 General Election", defaultVisible: true, componentPath: "@/components/elections/general/GeneralElectionRegistryChart", calculateStats, year: 2017 };
const chart2015: ChartDefinition<GeneralElectionDataset> = { group: "General Election", key: "generalElection-2015", label: "2015 General Election", defaultVisible: true, componentPath: "@/components/elections/general/GeneralElectionRegistryChart", calculateStats, year: 2015 };
export const generalElectionDefinition: ChartDatasetDefinition<GeneralElectionDataset> = {
	...generalElectionDatasetDefinition, chart: chart2024, charts: [chart2024, chart2019, chart2017, chart2015],
	legendAggregation: { calculateStats },
	mapRenderer: {
		getOptions: (_activeViz, mapOptions) => mapOptions.generalElection,
		render: ({ mapManager, geojson, dataset, mapOptions, isDark }) =>
			mapManager.updateMapForGeneralElection(geojson, dataset, mapOptions, isDark),
	},
};
