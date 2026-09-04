// lib/data/election/local-election/load.ts
import Papa from "papaparse";
import {
	LocalElectionDataset,
	LocalElectionWardData,
	LocalElectionYear,
} from "@lib/types/index";
import { WardYear } from "@/lib/data/boundaries/boundaries";
import { PARTY_INFO } from "@/lib/data/election/parties";
import {
	type ElectionSourceConfig,
	type ElectionTableSourceConfig,
	type LeapElectionSourceConfig,
	ELECTION_SOURCES,
} from "./config";

const KNOWN_PARTIES = ["LAB", "CON", "LD", "GREEN", "REF", "IND"];

const LEAP_PARTY_CODES: Record<string, string> = {
	C: "CON",
	Lab: "LAB",
	LD: "LD",
	Grn: "GREEN",
	Lib: "LD",
	UKIP: "UKIP",
	SNP: "SNP",
	PC: "PC",
	Ind: "IND",
};

type TableRow = Record<string, string>;

interface UnmappedLocalElectionWardData extends LocalElectionWardData {
	winningParty: string;
}

interface ParsedLocalElectionDataset extends LocalElectionDataset {
	_unmapped?: UnmappedLocalElectionWardData[];
}

const detectPartyColumns = (headers: string[]) =>
	headers.filter((h) => KNOWN_PARTIES.includes(h.toUpperCase().trim()));

const parseNumber = (val: string | undefined): number => {
	if (!val) return 0;
	const clean = String(val).replace(/,|%/g, "").trim();
	const num = parseFloat(clean);
	return isNaN(num) ? 0 : num;
};

const findWinner = (votes: Record<string, number | undefined>): string => {
	return Object.entries(votes).reduce(
		(winner, [party, count]) =>
			(count ?? 0) > (votes[winner] ?? 0) ? party : winner,
		"OTHER",
	);
};

// Parses one worksheet rendered as CSV into a dataset. This runs at precompile
// time, so PapaParse stays out of the client bundle.
export const parseLocalElectionTable = (
	text: string,
	config: ElectionTableSourceConfig,
): ParsedLocalElectionDataset => {
	// Heuristic: Skip metadata lines if they exist (detecting "Local authority name")
	// This replaces the hardcoded line splitting
	if (!text.startsWith(config.fields.ladName) && !text.startsWith("WD24")) {
		const lines = text.split("\n");
		const headerIndex = lines.findIndex(
			(l) =>
				l.includes(config.fields.name) ||
				l.includes(config.fields.ladName),
		);
		if (headerIndex > -1) text = lines.slice(headerIndex).join("\n");
	}

	const results = Papa.parse<Record<string, string>>(text, {
		header: true,
		skipEmptyLines: true,
		transformHeader: (h) => h.trim(),
	});

	const partyCols = detectPartyColumns(results.meta.fields || []);
	const wardWinners: Record<string, string> = {};
	const wardData: Record<string, LocalElectionWardData> = {};
	const unmapped: UnmappedLocalElectionWardData[] = [];

	results.data.forEach((row: TableRow) => {
		// Extract party votes
		const partyVotes: Record<string, number> = {};
		partyCols.forEach((p) => (partyVotes[p] = parseNumber(row[p])));

		// Normalize core data
		const laName =
			row[config.fields.ladName] || row["COUNTYNAME"] || "Unknown"; // Fallback for 2023
		const wName = row[config.fields.name];
		const rawCode = row[config.fields.code]?.trim() ?? "";
		const wCode =
			rawCode && config.wardCodeMap?.[rawCode]
				? config.wardCodeMap[rawCode]
				: rawCode;

		const entry: LocalElectionWardData = {
			wardCode: wCode,
			wardName: wName,
			ladName: laName,
			ladCode: row[config.fields.ladCode || ""] || "Unknown",
			turnoutPercent: parseNumber(row[config.fields.turnout]),
			electorate: parseNumber(row[config.fields.electorate]),
			totalVotes: parseNumber(row[config.fields.totalVotes || ""]),
			partyVotes,
		};

		// Handle mapped vs unmapped (2023 case)
		if (wCode) {
			wardWinners[wCode] = findWinner(partyVotes);
			wardData[wCode] = entry;
		} else {
			// Store raw unmapped data for post-processing
			unmapped.push({
				...entry,
				winningParty: findWinner(partyVotes),
			});
		}
	});

	return {
		id: `localElection${config.year}`,
		type: "localElection",
		year: config.year as LocalElectionYear,
		boundaryYear: (config.boundaryYear ?? config.year) as WardYear,
		boundaryType: "ward",
		results: wardWinners,
		data: wardData,
		partyInfo: PARTY_INFO,
		_unmapped: unmapped.length > 0 ? unmapped : undefined,
	};
};

/** Parses LEAP's headerless candidate rows into ward-level results. */
export const parseLeapLocalElection = (
	text: string,
	config: LeapElectionSourceConfig,
): LocalElectionDataset => {
	const wardData: Record<string, LocalElectionWardData> = {};
	const electedParties: Record<string, string[]> = {};
	const rows = Papa.parse<string[]>(text, { skipEmptyLines: true }).data;

	for (const row of rows) {
		const [ladName, ladCode, wardName, wardCode, , party, votes, elected] =
			row;
		// LEAP's Scottish records only contain first-preference totals, not STV
		// transfers. Keep this FPTP-compatible series to England and Wales.
		if (
			!wardCode ||
			(!wardCode.startsWith("E") && !wardCode.startsWith("W"))
		)
			continue;

		const entry = (wardData[wardCode] ??= {
			wardCode,
			wardName,
			ladName,
			ladCode,
			electorate: 0,
			totalVotes: 0,
			turnoutPercent: 0,
			partyVotes: {},
		});
		const partyCode = LEAP_PARTY_CODES[party?.trim() ?? ""] ?? "OTHER";
		const voteCount = parseNumber(votes);
		entry.partyVotes[partyCode] =
			(entry.partyVotes[partyCode] ?? 0) + voteCount;
		entry.totalVotes += voteCount;
		if (elected === "1") {
			const winners = (electedParties[wardCode] ??= []);
			if (!winners.includes(partyCode)) winners.push(partyCode);
		}
	}

	const results = Object.fromEntries(
		Object.entries(wardData).map(([code, entry]) => [
			code,
			entry.totalVotes > 0
				? findWinner(entry.partyVotes)
				: (electedParties[code]?.[0] ?? "OTHER"),
		]),
	);
	return {
		id: `localElection${config.year}`,
		type: "localElection",
		year: config.year as LocalElectionYear,
		boundaryYear: (config.boundaryYear ?? config.year) as WardYear,
		boundaryType: "ward",
		results,
		data: wardData,
		partyInfo: PARTY_INFO,
	};
};

// Loads and parses every configured local election worksheet via the provided
// reader (used by the precompile script), keyed by year. Reference datasets are
// parsed first so the 2023 dataset (which lacks ward codes) can be reconciled
// against them.
export const loadLocalElection = async (
	readSource: (source: ElectionSourceConfig) => Promise<string>,
): Promise<Record<string, LocalElectionDataset>> => {
	const refs: LocalElectionDataset[] = [];
	let raw2023: ParsedLocalElectionDataset | null = null;

	for (const config of Object.values(ELECTION_SOURCES)) {
		const text = await readSource(config);
		const dataset =
			config.source === "xlsx"
				? parseLocalElectionTable(text, config)
				: parseLeapLocalElection(text, config);
		if (config.isReference) refs.push(dataset);
		else raw2023 = dataset;
	}

	const datasets: Record<string, LocalElectionDataset> = {};
	refs.forEach((d) => (datasets[d.year] = d));
	if (raw2023) {
		const reconciled = reconcile2023Data(raw2023, refs);
		datasets[reconciled.year] = reconciled;
	}
	return datasets;
};

export const reconcile2023Data = (
	dataset2023: ParsedLocalElectionDataset,
	referenceSets: LocalElectionDataset[],
): LocalElectionDataset => {
	const { _unmapped: unmapped, ...dataset } = dataset2023;
	if (!unmapped) return dataset;

	// Build Lookup Map
	const lookup = new Map<string, string>();
	referenceSets.forEach((ds) => {
		Object.entries(ds.data).forEach(([code, data]) => {
			const key = `${data.ladName}|${data.wardName}`.toLowerCase();
			if (!lookup.has(key)) lookup.set(key, code);
		});
	});

	const results = { ...dataset.results };
	const data = { ...dataset.data };

	// Apply lookup without mutating the parsed source dataset.
	unmapped.forEach((item) => {
		const key = `${item.ladName}|${item.wardName}`.toLowerCase();
		const code = lookup.get(key);

		if (code) {
			results[code] = item.winningParty;
			data[code] = {
				...item,
				wardCode: code,
				ladCode: code.substring(0, 9), // Infer LA code from Ward Code
			};
		}
	});

	return { ...dataset, results, data };
};
