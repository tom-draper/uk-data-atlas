// lib/data/election/local-election/load.ts
import Papa from "papaparse";
import {
	LocalElectionDataset,
	LocalElectionExcludedWard,
	LocalElectionWardData,
	LocalElectionYear,
} from "@lib/types/index";
import { WardYear } from "@/lib/data/boundaries/boundaries";
import { PARTY_INFO } from "@/lib/data/election/parties";
import {
	type ElectionTableSourceConfig,
	type LeapElectionSourceConfig,
	ELECTION_SOURCES,
} from "./config";

/**
 * The party each source label is counted under. The House of Commons Library
 * uses short names from 2021 to 2024 and full names in 2025; LEAP has its own
 * abbreviations. Any other label, including local parties, residents'
 * associations and the Liberal Party (distinct from the Liberal Democrats), is
 * counted as OTHER.
 */
const PARTY_CODES: Record<string, string> = {
	CON: "CON",
	LAB: "LAB",
	LD: "LD",
	GREEN: "GREEN",
	REF: "REF",
	IND: "IND",
	UKIP: "UKIP",
	PC: "PC",
	"Conservative and Unionist Party": "CON",
	"Labour Party": "LAB",
	"Labour and Co-operative Party": "LAB",
	"Liberal Democrats": "LD",
	"Green Party": "GREEN",
	"Reform UK": "REF",
	Independent: "IND",
	"UK Independence Party (UKIP)": "UKIP",
	C: "CON",
	Lab: "LAB",
	Grn: "GREEN",
	Ind: "IND",
	SNP: "SNP",
};

const partyCode = (label: string) => PARTY_CODES[label.trim()] ?? "OTHER";

type TableRow = Record<string, string | undefined>;

type WardIdentityFields = { code?: string; name: string; ladName: string };

type Candidate = { party: string; votes: number; elected?: boolean };

const parseNumber = (val: string | undefined): number => {
	if (!val) return 0;
	const clean = String(val).replace(/,|%/g, "").trim();
	const num = parseFloat(clean);
	return isNaN(num) ? 0 : num;
};

const isWardCode = (code: string) => /^[EW](05|58)\d{6}$/.test(code);

/**
 * Names compared for an exact match, ignoring case, punctuation and ONS's
 * ", City of" suffix: the 2023 workbook writes "St. Johns" and "Kingston Upon
 * Hull" where ONS writes "St John's" and "Kingston upon Hull, City of". This is
 * not a fuzzy match.
 */
export const matchingName = (name: string) =>
	name
		.toLowerCase()
		.replace(/,\s*(city|county) of$/, "")
		.replace(/&/g, " and ")
		.replace(/['’.]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

/**
 * Votes as the House of Commons Library counts them for vote share: in each
 * ward, only each party's highest-polling candidate counts, so a party that
 * fields a full slate in a multi-member ward is not counted several times over.
 * A named party's labels form one slate, so Labour and Labour and Co-operative
 * candidates count once between them, and independents are treated as one.
 * Every other label is its own party. The winner is the party of the
 * highest-polling candidate.
 */
export const effectiveVotes = (candidates: Candidate[]) => {
	const top = new Map<string, { code: string; votes: number }>();
	for (const candidate of candidates) {
		const code = partyCode(candidate.party);
		const slate = code === "OTHER" ? `OTHER:${candidate.party}` : code;
		top.set(slate, {
			code,
			votes: Math.max(top.get(slate)?.votes ?? 0, candidate.votes),
		});
	}
	const partyVotes: Record<string, number> = {};
	let totalVotes = 0;
	let winner = { party: "OTHER", votes: 0 };
	for (const { code, votes } of top.values()) {
		partyVotes[code] = (partyVotes[code] ?? 0) + votes;
		totalVotes += votes;
		if (votes > winner.votes) winner = { party: code, votes };
	}
	if (totalVotes === 0) {
		// An uncontested ward has no votes; its winner is whoever was elected.
		const elected = candidates.find((candidate) => candidate.elected);
		if (elected) winner = { party: partyCode(elected.party), votes: 0 };
	}
	return { partyVotes, totalVotes, winner: winner.party };
};

/** Parses a worksheet rendered as CSV, starting at its header row. */
const parseSheet = (text: string, headerField: string) => {
	const lines = text.split("\n");
	const headerIndex = lines.findIndex((line) => line.includes(headerField));
	if (headerIndex === -1) {
		throw new Error(`No header row containing "${headerField}"`);
	}
	return Papa.parse<TableRow>(lines.slice(headerIndex).join("\n"), {
		header: true,
		skipEmptyLines: true,
		transformHeader: (header) => header.trim(),
	}).data;
};

const cell = (row: TableRow, field: string | undefined) =>
	field ? (row[field] ?? "").trim() : "";

/** The official ward codes of one release, keyed by authority and ward name. */
export const wardCodesByName = (
	geojson: string,
	fields: NonNullable<ElectionTableSourceConfig["wardList"]>,
) => {
	const codes = new Map<string, string[]>();
	for (const match of geojson.matchAll(/"properties":(\{[^{}]*\})/g)) {
		const properties = JSON.parse(match[1]) as Record<string, unknown>;
		const code = properties[fields.code];
		if (typeof code !== "string") continue;
		const key = `${matchingName(String(properties[fields.ladName]))}|${matchingName(String(properties[fields.name]))}`;
		codes.set(key, [...(codes.get(key) ?? []), code]);
	}
	return codes;
};

/**
 * Builds one year from the House of Commons Library workbook. Each ward's
 * identity, electorate and turnout come from the ward worksheet and its votes
 * from the candidate worksheet, because the ward worksheet counts only named
 * parties in some years and stores some minor-party votes as booleans in
 * others.
 */
export const parseLocalElectionTable = (
	wardText: string,
	candidateText: string,
	config: ElectionTableSourceConfig,
	wardList?: Map<string, string[]>,
): LocalElectionDataset => {
	const { fields, candidates: candidateSheet } = config;
	const excludedWards: LocalElectionExcludedWard[] = [];
	const remap = (code: string) => config.wardCodeMap?.[code] ?? code;

	// A workbook with codes is joined on code, and one without on authority
	// and ward name. The two worksheets can spell a ward differently.
	const keyFor = (row: TableRow, sheetFields: WardIdentityFields) =>
		sheetFields.code
			? remap(cell(row, sheetFields.code))
			: `${matchingName(cell(row, sheetFields.ladName))}|${matchingName(cell(row, sheetFields.name))}`;

	const candidatesByWard = new Map<
		string,
		Array<Candidate & { name: string }>
	>();
	for (const row of parseSheet(candidateText, candidateSheet.fields.name)) {
		if (!cell(row, candidateSheet.fields.name)) continue;
		const key = keyFor(row, candidateSheet.fields);
		candidatesByWard.set(key, [
			...(candidatesByWard.get(key) ?? []),
			{
				name: matchingName(cell(row, candidateSheet.fields.name)),
				party: cell(row, candidateSheet.fields.party),
				votes: parseNumber(row[candidateSheet.fields.votes]),
			},
		]);
	}

	const wardRows = parseSheet(wardText, fields.name).filter(
		(row) => cell(row, fields.name) && cell(row, fields.name) !== "NA",
	);
	// The 2022 workbook gives two different wards the same code, so a code
	// that names more than one ward in the ward worksheet identifies neither.
	const wardNamesByCode = new Map<string, Set<string>>();
	if (fields.code) {
		for (const row of wardRows) {
			const code = remap(cell(row, fields.code));
			wardNamesByCode.set(
				code,
				(wardNamesByCode.get(code) ?? new Set()).add(
					matchingName(cell(row, fields.name)),
				),
			);
		}
	}

	const results: Record<string, string> = {};
	const data: Record<string, LocalElectionWardData> = {};
	for (const row of wardRows) {
		const wardName = cell(row, fields.name);
		const ladName = cell(row, fields.ladName);
		const exclude = (reason: LocalElectionExcludedWard["reason"]) =>
			excludedWards.push({
				wardName,
				ladName,
				...(fields.code ? { wardCode: cell(row, fields.code) } : {}),
				reason,
			});

		let wardCode: string;
		if (fields.code) {
			wardCode = remap(cell(row, fields.code));
			if (!isWardCode(wardCode)) {
				exclude("no-ward-code");
				continue;
			}
			if ((wardNamesByCode.get(wardCode)?.size ?? 0) > 1) {
				exclude("code-shared-by-wards");
				continue;
			}
		} else {
			const matches =
				wardList?.get(
					`${matchingName(ladName)}|${matchingName(wardName)}`,
				) ?? [];
			if (matches.length !== 1) {
				exclude(
					matches.length === 0
						? "name-not-in-ward-list"
						: "name-ambiguous",
				);
				continue;
			}
			wardCode = matches[0];
		}

		// Where the candidate worksheet also gives this code to another ward,
		// as it gives Llanelwedd's to Llanwddyn in 2022, keep only the candidates
		// named for this ward.
		const coded = candidatesByWard.get(keyFor(row, fields)) ?? [];
		const candidates =
			new Set(coded.map((candidate) => candidate.name)).size > 1
				? coded.filter(
						(candidate) =>
							candidate.name === matchingName(wardName),
					)
				: coded;
		if (candidates.length === 0) {
			exclude("no-candidates");
			continue;
		}
		if (data[wardCode]) {
			throw new Error(
				`${config.path}: ${wardName} and ${data[wardCode].wardName} both resolve to ${wardCode}`,
			);
		}
		const { partyVotes, totalVotes, winner } = effectiveVotes(candidates);
		results[wardCode] = winner;
		data[wardCode] = {
			wardCode,
			wardName,
			ladName,
			ladCode: cell(row, fields.ladCode) || "Unknown",
			turnoutPercent: parseNumber(row[fields.turnout]),
			electorate: parseNumber(row[fields.electorate]),
			totalVotes,
			partyVotes,
		};
	}

	return {
		id: `localElection${config.year}`,
		type: "localElection",
		year: config.year as LocalElectionYear,
		boundaryYear: (config.boundaryYear ?? config.year) as WardYear,
		boundaryType: "ward",
		results,
		data,
		partyInfo: PARTY_INFO,
		wardCodes: config.wardList ? "name-matched" : "published",
		...(excludedWards.length > 0 ? { excludedWards } : {}),
	};
};

/** Parses LEAP's headerless candidate rows into ward-level results. */
export const parseLeapLocalElection = (
	text: string,
	config: LeapElectionSourceConfig,
): LocalElectionDataset => {
	const wards: Record<
		string,
		Pick<LocalElectionWardData, "wardName" | "ladName" | "ladCode"> & {
			candidates: Candidate[];
		}
	> = {};
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

		const ward = (wards[wardCode] ??= {
			wardName,
			ladName,
			ladCode,
			candidates: [],
		});
		ward.candidates.push({
			party: party?.trim() ?? "",
			votes: parseNumber(votes),
			elected: elected === "1",
		});
	}

	const results: Record<string, string> = {};
	const data: Record<string, LocalElectionWardData> = {};
	for (const [wardCode, { candidates, ...ward }] of Object.entries(wards)) {
		const { partyVotes, totalVotes, winner } = effectiveVotes(candidates);
		results[wardCode] = winner;
		data[wardCode] = {
			wardCode,
			...ward,
			electorate: 0,
			totalVotes,
			turnoutPercent: 0,
			partyVotes,
		};
	}
	return {
		id: `localElection${config.year}`,
		type: "localElection",
		year: config.year as LocalElectionYear,
		boundaryYear: (config.boundaryYear ?? config.year) as WardYear,
		boundaryType: "ward",
		results,
		data,
		partyInfo: PARTY_INFO,
		wardCodes: "published",
	};
};

export type LocalElectionReader = {
	text: (path: string) => Promise<string>;
	xlsxSheet: (path: string, sheet: string) => Promise<string>;
};

// Loads and parses every configured local election source via the provided
// reader (used by the precompile script), keyed by year.
export const loadLocalElection = async (
	reader: LocalElectionReader,
): Promise<Record<string, LocalElectionDataset>> => {
	const datasets: Record<string, LocalElectionDataset> = {};
	for (const config of Object.values(ELECTION_SOURCES)) {
		if (config.source === "leap") {
			datasets[config.year] = parseLeapLocalElection(
				await reader.text(config.path),
				config,
			);
			continue;
		}
		const wardList = config.wardList
			? wardCodesByName(
					await reader.text(config.wardList.path),
					config.wardList,
				)
			: undefined;
		datasets[config.year] = parseLocalElectionTable(
			await reader.xlsxSheet(config.path, config.sheet),
			await reader.xlsxSheet(config.path, config.candidates.sheet),
			config,
			wardList,
		);
	}
	return datasets;
};
