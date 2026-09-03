// lib/utils/generalElectionUtils.ts
import Papa from "papaparse";
import {
	GeneralElectionConstituencyData,
	GeneralElectionDataset,
} from "@lib/types";
import {
	GeneralElectionSourceConfig,
	GENERAL_ELECTION_SOURCES,
} from "./config";
import { PARTY_INFO } from "@/lib/data/election/parties";
import { calculateTurnout } from "@/lib/helpers/generalElection";

// Utility to parse vote counts efficiently
const parseVotes = (value: any): number => {
	if (!value || value === "") return 0;
	const parsed = parseInt(String(value).replace(/,/g, "").trim());
	return isNaN(parsed) ? 0 : parsed;
};

// Parses a single general election CSV into a dataset. Runs at precompile time
// (Node) so PapaParse stays out of the client bundle.
export const parseGeneralElectionCsv = (
	csvText: string,
	config: GeneralElectionSourceConfig,
): GeneralElectionDataset => {
	// Conditional Header Cleaning (Specific to the 2024 dataset)
	if (config.requiresHeaderCleaning) {
		const lines = csvText.split("\n");
		// Find the actual header row by searching for the ONS ID column
		const dataStart = lines.findIndex((line) =>
			line.includes(config.fields.onsId),
		);
		csvText = lines.slice(dataStart).join("\n");
	}

	const results = Papa.parse<Record<string, string>>(csvText, {
		header: true,
		skipEmptyLines: true,
		dynamicTyping: false,
	});

	const constituencyResults: Record<string, string> = {};
	const constituencyData: Record<string, GeneralElectionConstituencyData> =
		{};

	for (const row of results.data as any[]) {
		const onsId = row[config.fields.onsId]?.trim();
		if (!onsId) continue;

		// 1. Parse party votes using config's party list
		const partyVotes: Record<string, number> = {};
		for (const party of config.fields.partyColumns) {
			const votes = parseVotes(row[party]);
			if (votes > 0) {
				partyVotes[party.toUpperCase()] = votes;
			}
		}

		// 2. Parse "All other candidates" as OTHER
		const otherVotes = parseVotes(row[config.fields.otherCandidates]);
		if (otherVotes > 0) {
			partyVotes["OTHER"] = otherVotes;
		}

		// 3. Extract core data
		const winningParty =
			row[config.fields.firstParty]?.trim().toUpperCase() || "OTHER";
		const electorate = parseVotes(row[config.fields.electorate]);
		const validVotes = parseVotes(row[config.fields.validVotes]);
		const invalidVotes = parseVotes(row[config.fields.invalidVotes]);

		const turnoutPercent =
			calculateTurnout(validVotes, invalidVotes, electorate) ?? 0;

		constituencyResults[onsId] = winningParty;
		constituencyData[onsId] = {
			constituencyName: row[config.fields.constituencyName] || "Unknown",
			onsId,
			regionName: row[config.fields.regionName] || "Unknown",
			countryName: row[config.fields.countryName] || "Unknown",
			constituencyType: row["Constituency type"] || "Unknown", // Hardcoded field name is fine here
			memberFirstName: row["Member first name"] || "",
			memberSurname: row["Member surname"] || "",
			memberGender: row["Member gender"] || "",
			result: row["Result"] || "",
			firstParty: row["First party"] || "",
			secondParty: row["Second party"] || "",
			electorate,
			validVotes,
			invalidVotes,
			majority: parseVotes(row[config.fields.majority]),
			partyVotes,
			turnoutPercent,
		};
	}

	return {
		id: `generalElection-${config.year}`,
		type: "generalElection",
		year: config.year,
		boundaryYear: config.constituencyBoundaryYear, // Use configurable boundary year
		boundaryType: "constituency",
		results: constituencyResults,
		data: constituencyData,
		partyInfo: PARTY_INFO,
	};
};

// Loads and parses every configured general election CSV via the provided
// reader (used by the precompile script), keyed by year.
export const loadGeneralElection = async (
	read: (path: string) => Promise<string>,
): Promise<Record<string, GeneralElectionDataset>> => {
	const datasets: Record<string, GeneralElectionDataset> = {};
	for (const config of Object.values(GENERAL_ELECTION_SOURCES)) {
		const csvText = await read(config.path);
		const dataset = parseGeneralElectionCsv(csvText, config);
		datasets[dataset.year] = dataset;
	}
	return datasets;
};
