import Papa from "papaparse";
import type { HistoricalPartyGroup } from "../../types/historicalGeneralElection.ts";
import type {
	DirectPart,
	DirectRecord,
	DirectValue,
} from "../../declaration/statistics.ts";
import { sourceDir } from "../../declaration/sources.ts";

const SOURCE_PATH = sourceDir(
	"historical-general-election",
	"1918-2019election_results.csv",
);

// The source's header row has trailing spaces on a couple of columns
// ("lib_votes ", "turnout "), so these are named exactly, not derived.
const PARTY_FIELDS: Record<
	HistoricalPartyGroup,
	{ votes: string; share: string }
> = {
	CON: { votes: "con_votes", share: "con_share" },
	LIB: { votes: "lib_votes ", share: "lib_share" },
	LAB: { votes: "lab_votes", share: "lab_share" },
	NAT: { votes: "natSW_votes", share: "natSW_share" },
	OTHER: { votes: "oth_votes", share: "oth_share" },
};

// The source uses -1 as a "no data" marker in a handful of columns; treat any
// negative value the same way rather than surfacing an impossible vote count.
const parseNum = (value: string | undefined): number | null => {
	if (value === undefined) return null;
	const trimmed = value.trim();
	if (trimmed === "") return null;
	const parsed = Number(trimmed);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

/**
 * The Library's table as the records of each election's contests, one part
 * per election. A figure the table leaves blank or marks -1 has no value. The
 * table gives vote and turnout shares as fractions, stored as percentages.
 */
export const historicalGeneralElectionParts = (
	csvText: string,
): DirectPart[] => {
	const { data } = Papa.parse<Record<string, string>>(csvText, {
		header: true,
		skipEmptyLines: true,
	});

	const elections = new Map<string, Map<string, DirectRecord>>();
	for (const row of data) {
		const election = row.election?.trim();
		if (!election) continue;
		const records = elections.get(election) ?? new Map();
		elections.set(election, records);

		// A small number of pre-1945 rows (mostly Irish constituencies) have
		// no constituency_id in the source. Fall back to the name, which is
		// unique within a single election, rather than dropping the row.
		const constituencyName = row.constituency_name?.trim() || "Unknown";
		const code =
			row.constituency_id?.trim() || constituencyName.toLowerCase();

		const values: DirectValue[] = [];
		const add = (
			measure: string,
			value: number | null,
			party?: HistoricalPartyGroup,
		) =>
			values.push({
				measure,
				...(party ? { members: { "party-group": party } } : {}),
				value,
			});
		add("seats", parseNum(row.seats) ?? 1);
		add("electorate", parseNum(row.electorate));
		for (const [party, fields] of Object.entries(PARTY_FIELDS) as [
			HistoricalPartyGroup,
			(typeof PARTY_FIELDS)[HistoricalPartyGroup],
		][]) {
			const votes = parseNum(row[fields.votes]);
			const share = parseNum(row[fields.share]);
			if (votes !== null) add("party-votes", votes, party);
			if (share !== null) add("party-vote-share", share * 100, party);
		}
		add("valid-votes", parseNum(row.total_votes));
		const turnout = parseNum(row["turnout "] ?? row.turnout);
		add("turnout", turnout === null ? null : turnout * 100);

		// A repeated constituency replaces the earlier row.
		records.set(code, {
			code,
			contest: {
				area_name: constituencyName,
				region: row["country/region"]?.trim() || "Unknown",
			},
			values,
		});
	}

	return [...elections].map(([key, records]) => ({
		key,
		records: [...records.values()],
	}));
};

/**
 * The constituencies of each boundary set, by Library id and the name the
 * latest election gives them, in election order. Used to write the areas
 * results are keyed by, so it reads the same id as the records do.
 */
export const historicalConstituencyNames = (
	csvText: string,
): Map<string, Map<string, string>> => {
	const { data } = Papa.parse<Record<string, string>>(csvText, {
		header: true,
		skipEmptyLines: true,
	});
	// Per election, constituencies by id: whole-number ids first, ascending,
	// then the rest in table order, as an object keyed by id lists them.
	const elections = new Map<string, Map<string, [string, string]>>();
	for (const row of data) {
		const election = row.election?.trim();
		if (!election) continue;
		const name = row.constituency_name?.trim() || "Unknown";
		const id = row.constituency_id?.trim() || name.toLowerCase();
		const rows = elections.get(election) ?? new Map();
		elections.set(election, rows);
		rows.set(id, [row.boundary_set?.trim() ?? "", name]);
	}
	const sets = new Map<string, Map<string, string>>();
	const ordered = [...elections].sort(
		([a], [b]) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b),
	);
	for (const [, rows] of ordered) {
		const whole = (id: string) => /^(0|[1-9]\d*)$/.test(id);
		const ids = [
			...[...rows.keys()]
				.filter(whole)
				.sort((a, b) => Number(a) - Number(b)),
			...[...rows.keys()].filter((id) => !whole(id)),
		];
		for (const id of ids) {
			const [set, name] = rows.get(id)!;
			let names = sets.get(set);
			if (!names) sets.set(set, (names = new Map()));
			names.set(id, name);
		}
	}
	return sets;
};

export const historicalGeneralElectionStatisticsParts = async (
	read: (path: string) => Promise<string>,
): Promise<DirectPart[]> =>
	historicalGeneralElectionParts(await read(SOURCE_PATH));
