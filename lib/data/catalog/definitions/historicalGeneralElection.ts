import { loadHistoricalGeneralElection } from "../../historical-general-election/loader";
import type { HistoricalGeneralElectionDataset } from "@/lib/types/historicalGeneralElection";
import type { DatasetDefinition } from "../types";

/**
 * Precompiled for downstream use, but deliberately not registered as a chart
 * dataset (lib/datasets/) yet: it has no boundary geometry to render against,
 * since it predates every boundary vintage this atlas has.
 */
export const historicalGeneralElectionDatasetDefinition: DatasetDefinition<HistoricalGeneralElectionDataset> =
	{
		type: "historicalGeneralElection",
		precompiledFile: "historical-general-election",
		boundaryType: "constituency",
		chartPending: true,
		ingestion: {
			minimumDatasets: 28,
			requiredDataFields: ["constituencyName", "votes"],
		},
		source: {
			name: "General Election Results, 1918-2019",
			source: "House of Commons Library",
			sourceUrl:
				"https://commonslibrary.parliament.uk/research-briefings/cbp-8647/",
			year: "1918-2019",
			licence: "Open Parliament Licence",
			licenceUrl:
				"https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/",
			description:
				"General election results by constituency for every UK general election from 1918 to 2019, aggregated to broad Conservative/Liberal/Labour/Nationalist/Other vote shares.",
		},
		precompile: async ({ text }) => loadHistoricalGeneralElection(text),
	};
