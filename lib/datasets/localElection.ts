import { localElectionDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { LocalElectionDataset } from "@/lib/types/elections";
import type { ChartDatasetDefinition, ChartDefinition } from "./types";

const calculateStats: ChartDefinition<LocalElectionDataset>["calculateStats"] =
	(mapManager, geojson, data, location, datasetId) =>
		mapManager.calculateLocalElectionStats(geojson, data, location, datasetId);

const chart2025: ChartDefinition<LocalElectionDataset> = { group: "Local Election", key: "localElection-2025", label: "2025 Local Elections", defaultVisible: true, componentPath: "@/components/elections/local/LocalElectionRegistryChart", calculateStats, year: 2025 };
const chart2024: ChartDefinition<LocalElectionDataset> = { group: "Local Election", key: "localElection-2024", label: "2024 Local Elections", defaultVisible: true, componentPath: "@/components/elections/local/LocalElectionRegistryChart", calculateStats, year: 2024 };
const chart2023: ChartDefinition<LocalElectionDataset> = { group: "Local Election", key: "localElection-2023", label: "2023 Local Elections", defaultVisible: true, componentPath: "@/components/elections/local/LocalElectionRegistryChart", calculateStats, year: 2023 };
const chart2022: ChartDefinition<LocalElectionDataset> = { group: "Local Election", key: "localElection-2022", label: "2022 Local Elections", defaultVisible: true, componentPath: "@/components/elections/local/LocalElectionRegistryChart", calculateStats, year: 2022 };
const chart2021: ChartDefinition<LocalElectionDataset> = { group: "Local Election", key: "localElection-2021", label: "2021 Local Elections", defaultVisible: true, componentPath: "@/components/elections/local/LocalElectionRegistryChart", calculateStats, year: 2021 };
export const localElectionDefinition: ChartDatasetDefinition<LocalElectionDataset> = {
	...localElectionDatasetDefinition, chart: chart2025, charts: [chart2025, chart2024, chart2023, chart2022, chart2021],
	legendAggregation: { calculateStats },
	mapRenderer: {
		getOptions: (_activeViz, mapOptions) => mapOptions.localElection,
		render: ({ mapManager, geojson, dataset, mapOptions, isDark }) =>
			mapManager.updateMapForLocalElection(geojson, dataset, mapOptions, isDark),
	},
};
