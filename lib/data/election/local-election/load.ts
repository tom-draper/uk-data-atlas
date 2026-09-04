// lib/data/election/local-election/load.ts
import Papa from "papaparse";
import {
	LocalElectionDataset,
	LocalElectionWardData,
	LocalElectionYear,
} from "@lib/types/index";
import { WardYear } from "@/lib/data/boundaries/boundaries";
import { PARTY_INFO } from "@/lib/data/election/parties";
import { ElectionSourceConfig, ELECTION_SOURCES } from "./config";

const KNOWN_PARTIES = ["LAB", "CON", "LD", "GREEN", "REF", "IND"];

type CsvRow = Record<string, string>;

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

const findWinner = (votes: Record<string, number>): string => {
	return Object.entries(votes).reduce(
		(winner, [party, count]) =>
			count > (votes[winner] || 0) ? party : winner,
		"OTHER",
	);
};

// Parses a single local election CSV into a dataset. Runs at precompile time
// (Node) so PapaParse stays out of the client bundle.
export const parseLocalElectionCsv = (
	text: string,
	config: ElectionSourceConfig,
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

	results.data.forEach((row: CsvRow) => {
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

// Loads and parses every configured local election worksheet via the provided
// reader (used by the precompile script), keyed by year. Reference datasets are
// parsed first so the 2023 dataset (which lacks ward codes) can be reconciled
// against them.
export const loadLocalElection = async (
	readSheet: (path: string, sheet: string) => Promise<string>,
): Promise<Record<string, LocalElectionDataset>> => {
	const refs: LocalElectionDataset[] = [];
	let raw2023: ParsedLocalElectionDataset | null = null;

	for (const config of Object.values(ELECTION_SOURCES)) {
		const text = await readSheet(config.path, config.sheet);
		const dataset = parseLocalElectionCsv(text, config);
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
