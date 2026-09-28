import { loadLocalElection } from "../../election/local-election/load";
import type { LocalElectionDataset } from "@/lib/types/elections";
import type { DatasetDefinition } from "../types";

export const localElectionDatasetDefinition: DatasetDefinition<LocalElectionDataset> =
	{
		type: "localElection",
		precompiledFile: "local-election",
		boundaryType: "ward",
		coverageCountries: ["GB-ENG", "GB-WLS"],
		payload: {
			regionChunks: {
				kind: "regional",
				wardToLadFallback: true,
				locationAggregate: "localElection",
			},
		},
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
				"Ward-level local election results for England and Wales. Party votes count each party's highest-polling candidate in a ward, the House of Commons Library's method for vote share in multi-member wards. The 2016–2019 archive has no electorate or turnout, and excludes Scottish STV results. The 2023 workbook has no ward codes, so they are matched by exact name to the ONS May 2023 ward list.",
		},
		precompile: async ({ text, xlsxSheet }) =>
			loadLocalElection({ text, xlsxSheet }),
	};
