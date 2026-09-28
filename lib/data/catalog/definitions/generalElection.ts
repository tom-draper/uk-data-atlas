import { loadGeneralElection } from "../../election/general-election/load";
import type { GeneralElectionDataset } from "@/lib/types/elections";
import type { DatasetDefinition } from "../types";

export const generalElectionDatasetDefinition: DatasetDefinition<GeneralElectionDataset> =
	{
		type: "generalElection",
		precompiledFile: "general-election",
		boundaryType: "constituency",
		source: {
			name: "General Election Results",
			source: "House of Commons Library",
			sourceUrl: "https://commonslibrary.parliament.uk/",
			year: "2010, 2015, 2017, 2019, 2024",
			licence: "Open Parliament Licence",
			licenceUrl:
				"https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/",
			description:
				"General election results by parliamentary constituency.",
		},
		precompile: async ({ text }) => loadGeneralElection(text),
	};
