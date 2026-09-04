import { renderLocalElection } from "@/lib/helpers/mapRendering";
import { localElectionDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { LocalElectionDataset } from "@/lib/types/elections";
import type { ChartDatasetDefinition, ChartDefinition } from "./types";

const calculateStats: ChartDefinition<LocalElectionDataset>["calculateStats"] =
	(mapManager, geojson, data, location, datasetId) =>
		mapManager.calculateLocalElectionStats(
			geojson,
			data,
			location,
			datasetId,
		);

const localElectionChart = (
	year: LocalElectionDataset["year"],
): ChartDefinition<LocalElectionDataset> => ({
	group: "Local Election",
	key: `localElection-${year}`,
	label: `${year} Local Elections`,
	defaultVisible: true,
	componentPath: "@/components/elections/local/LocalElectionRegistryChart",
	calculateStats,
	year,
});

const localElectionYears: LocalElectionDataset["year"][] = [
	2025, 2024, 2023, 2022, 2021, 2019, 2018, 2017, 2016,
];
const localElectionCharts = localElectionYears.map(localElectionChart);

export const localElectionDefinition: ChartDatasetDefinition<LocalElectionDataset> =
	{
		...localElectionDatasetDefinition,
		chart: localElectionChart(2025),
		charts: localElectionCharts,
		legendAggregation: { calculateStats },
		legendKind: "party",
		mapRenderer: {
			getOptions: (_activeViz, mapOptions) => mapOptions.localElection,
			render: ({ map, geojson, dataset, mapOptions, isDark }) =>
				renderLocalElection(map, geojson, dataset, mapOptions, isDark),
		},
	};
