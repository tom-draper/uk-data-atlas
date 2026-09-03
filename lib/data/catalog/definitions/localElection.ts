import { loadLocalElection } from "../../election/local-election/load";
import type { LocalElectionDataset } from "@/lib/types/elections";
import type { DatasetDefinition } from "../types";

export const localElectionDatasetDefinition: DatasetDefinition<LocalElectionDataset> = {
	type: "localElection", precompiledFile: "local-election", boundaryType: "ward",
	source: { name: "Local Election Results", source: "House of Commons Library", sourceUrl: "https://commonslibrary.parliament.uk/2025-local-elections-handbook-and-dataset/", year: "2021, 2022, 2023, 2024, 2025", licence: "Open Parliament Licence", licenceUrl: "https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/", description: "Local election results by electoral ward for England and Wales." },
	precompile: async ({ text }) => loadLocalElection(text),
};
