import Papa from "papaparse";
import type {
	HistoricalElectionConstituencyResult,
	HistoricalGeneralElectionDataset,
	HistoricalPartyGroup,
} from "@/lib/types/historicalGeneralElection";

const SOURCE_PATH =
	"politics/elections/general-elections/1918-2019/1918-2019election_results.csv";

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

// "1974F" (Feb 1974) and "1974O" (Oct 1974) both belong to calendar year 1974.
const electionYear = (election: string): number => parseInt(election, 10);

export const parseHistoricalGeneralElectionCsv = (
	csvText: string,
): Record<string, HistoricalGeneralElectionDataset> => {
	const { data } = Papa.parse<Record<string, string>>(csvText, {
		header: true,
		skipEmptyLines: true,
	});

	const datasets: Record<string, HistoricalGeneralElectionDataset> = {};

	for (const row of data) {
		const election = row.election?.trim();
		if (!election) continue;

		const dataset = (datasets[election] ??= {
			id: `historicalGeneralElection-${election}`,
			type: "historicalGeneralElection",
			election,
			year: electionYear(election),
			boundaryType: "constituency",
			boundaryYear: electionYear(election),
			boundarySet: row.boundary_set?.trim() ?? "",
			data: {},
		});

		// A small number of pre-1945 rows (mostly Irish constituencies) have
		// no constituency_id in the source. Fall back to the name, which is
		// unique within a single election, rather than dropping the row.
		const rawId = row.constituency_id?.trim();
		const constituencyName = row.constituency_name?.trim() || "Unknown";
		const constituencyId = rawId || constituencyName.toLowerCase();

		const votes: Partial<Record<HistoricalPartyGroup, number>> = {};
		const voteShare: Partial<Record<HistoricalPartyGroup, number>> = {};
		for (const [party, fields] of Object.entries(PARTY_FIELDS) as [
			HistoricalPartyGroup,
			(typeof PARTY_FIELDS)[HistoricalPartyGroup],
		][]) {
			const partyVotes = parseNum(row[fields.votes]);
			const partyShare = parseNum(row[fields.share]);
			if (partyVotes !== null) votes[party] = partyVotes;
			if (partyShare !== null) voteShare[party] = partyShare * 100;
		}

		const turnout = parseNum(row["turnout "] ?? row.turnout);

		const result: HistoricalElectionConstituencyResult = {
			constituencyId,
			constituencyName,
			region: row["country/region"]?.trim() || "Unknown",
			seats: parseNum(row.seats) ?? 1,
			electorate: parseNum(row.electorate),
			votes,
			voteShare,
			totalVotes: parseNum(row.total_votes),
			turnoutPercent: turnout === null ? null : turnout * 100,
		};

		dataset.data[constituencyId] = result;
	}

	return datasets;
};

export const loadHistoricalGeneralElection = async (
	read: (path: string) => Promise<string>,
): Promise<Record<string, HistoricalGeneralElectionDataset>> =>
	parseHistoricalGeneralElectionCsv(await read(SOURCE_PATH));
