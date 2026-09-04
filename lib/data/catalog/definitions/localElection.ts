import { loadLocalElection } from "../../election/local-election/load";
import type { LocalElectionDataset } from "@/lib/types/elections";
import type { DatasetDefinition } from "../types";

export const localElectionDatasetDefinition: DatasetDefinition<LocalElectionDataset> =
	{
		type: "localElection",
		precompiledFile: "local-election",
		boundaryType: "ward",
		ingestion: {
			minimumDatasets: 9,
			requiredDataFields: ["wardCode", "wardName", "partyVotes"],
		},
		source: {
			name: "Local Election Results",
			source: "House of Commons Library (2021–2025); Local Elections Archive Project (2016–2019)",
			sourceUrl: "https://www.andrewteale.me.uk/leap/",
			year: "2016–2019, 2021–2025",
			licence:
				"Open Parliament Licence (2021–2025); CC BY-SA 3.0 (2016–2019)",
			licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
			description:
				"Ward-level local election results for England and Wales. The 2016–2019 archive has candidate votes but not electorate or turnout, and excludes Scottish STV results.",
		},
		precompile: async ({ xlsxSheet, zipCsv }) =>
			loadLocalElection((source) =>
				source.source === "xlsx"
					? xlsxSheet(source.path, source.sheet)
					: zipCsv(source.path),
			),
	};
