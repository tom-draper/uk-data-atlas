import { loadGeneralElection } from "@/lib/data/election/general-election/load";
import type { GeneralElectionDataset } from "@/lib/types/elections";
import type { ChartDatasetDefinition, ChartDefinition } from "./types";

const calculateStats: ChartDefinition<GeneralElectionDataset>["calculateStats"] =
	(mapManager, geojson, data, location, datasetId) =>
		mapManager.calculateGeneralElectionStats(geojson, data, location, datasetId);

const chart2024: ChartDefinition<GeneralElectionDataset> = { group: "General Election", key: "generalElection-2024", label: "2024 General Election", defaultVisible: true, componentPath: "@/components/elections/general/GeneralElectionRegistryChart", boundaryType: "constituency", calculateStats, year: 2024 };
const chart2019: ChartDefinition<GeneralElectionDataset> = { group: "General Election", key: "generalElection-2019", label: "2019 General Election", defaultVisible: true, componentPath: "@/components/elections/general/GeneralElectionRegistryChart", boundaryType: "constituency", calculateStats, year: 2019 };
const chart2017: ChartDefinition<GeneralElectionDataset> = { group: "General Election", key: "generalElection-2017", label: "2017 General Election", defaultVisible: true, componentPath: "@/components/elections/general/GeneralElectionRegistryChart", boundaryType: "constituency", calculateStats, year: 2017 };
const chart2015: ChartDefinition<GeneralElectionDataset> = { group: "General Election", key: "generalElection-2015", label: "2015 General Election", defaultVisible: true, componentPath: "@/components/elections/general/GeneralElectionRegistryChart", boundaryType: "constituency", calculateStats, year: 2015 };
export const generalElectionDefinition: ChartDatasetDefinition<GeneralElectionDataset> = {
	type: "generalElection", precompiledFile: "general-election", chart: chart2024, charts: [chart2024, chart2019, chart2017, chart2015],
	source: { name: "General Election Results", source: "House of Commons Library", sourceUrl: "https://commonslibrary.parliament.uk/", year: "2010, 2015, 2017, 2019, 2024", licence: "Open Parliament Licence", licenceUrl: "https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/", description: "General election results by parliamentary constituency." },
	precompile: async ({ text }) => loadGeneralElection(text),
};
