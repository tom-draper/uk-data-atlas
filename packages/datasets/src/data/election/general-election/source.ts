import Papa from "papaparse";
import type {
	DirectPart,
	DirectRecord,
} from "../../../declaration/statistics.ts";
import {
	type GeneralElectionSourceConfig,
	GENERAL_ELECTION_SOURCES,
} from "./config.ts";

const parseVotes = (value: unknown): number => {
	if (!value || value === "") return 0;
	const parsed = parseInt(String(value).replace(/,/g, "").trim());
	return isNaN(parsed) ? 0 : parsed;
};

/**
 * One House of Commons Library results table as the records of its contests.
 * A party that took no votes has no value, "All other candidates" is the party
 * OTHER, and the winner is the party the table names first, OTHER if blank.
 */
export const generalElectionRecords = (
	csvText: string,
	config: GeneralElectionSourceConfig,
): DirectRecord[] => {
	// The 2024 table has rows of notes above its header.
	if (config.requiresHeaderCleaning) {
		const lines = csvText.split("\n");
		const dataStart = lines.findIndex((line) =>
			line.includes(config.fields.onsId),
		);
		csvText = lines.slice(dataStart).join("\n");
	}

	const { fields } = config;
	const results = Papa.parse<Record<string, string>>(csvText, {
		header: true,
		skipEmptyLines: true,
		dynamicTyping: false,
	});

	const records: DirectRecord[] = [];
	for (const row of results.data) {
		const onsId = row[fields.onsId]?.trim();
		if (!onsId) continue;

		const partyVotes: Record<string, number> = {};
		for (const sourceColumn of fields.partyColumns) {
			const votes = parseVotes(row[sourceColumn]);
			if (votes > 0) {
				const party =
					fields.partyColumnAliases?.[sourceColumn] ?? sourceColumn;
				partyVotes[party.toUpperCase()] = votes;
			}
		}
		const otherVotes = parseVotes(row[fields.otherCandidates]);
		if (otherVotes > 0) partyVotes["OTHER"] = otherVotes;

		const count = (measure: string, column: string) => ({
			measure,
			value: parseVotes(row[column]),
		});
		records.push({
			code: onsId,
			contest: {
				area_name: row[fields.constituencyName] || "Unknown",
				region: row[fields.regionName] || "Unknown",
				country: row[fields.countryName] || "Unknown",
				constituency_type: row["Constituency type"] || "Unknown",
				result: row["Result"] || "",
				first_party: row["First party"] || "",
				second_party: row["Second party"] || "",
				winner: row[fields.firstParty]?.trim().toUpperCase() || "OTHER",
			},
			elected: {
				given_name: row["Member first name"] || "",
				family_name: row["Member surname"] || "",
				gender: row["Member gender"] || "",
			},
			values: [
				...Object.entries(partyVotes).map(([party, value]) => ({
					measure: "party-votes",
					members: { party },
					value,
				})),
				count("electorate", fields.electorate),
				count("valid-votes", fields.validVotes),
				count("rejected-ballots", fields.invalidVotes),
				count("majority", fields.majority),
			],
		});
	}
	return records;
};

/** Every configured general election, one part per year. */
export const generalElectionStatisticsParts = async (
	read: (path: string) => Promise<string>,
): Promise<DirectPart[]> => {
	const parts: DirectPart[] = [];
	for (const config of Object.values(GENERAL_ELECTION_SOURCES))
		parts.push({
			key: String(config.year),
			records: generalElectionRecords(await read(config.path), config),
		});
	return parts;
};
