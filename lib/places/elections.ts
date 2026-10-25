/**
 * Local election results for the /places pages: each ward's latest result
 * and earlier winners, and each council's elections summed over its wards.
 * Compiled from the local election dataset by `scripts/build-seo-data.mts`,
 * as the dataset is far too large to read while rendering a page.
 *
 * The source counts each party's highest-polling candidate in a ward, so a
 * ward electing several councillors gives one result rather than its seats.
 * A council's figures are wards won and vote share, never seats or control.
 */

/** Party key and votes, most votes first. */
export type PartyVotes = [party: string, votes: number][];

export type WardResult = {
	year: number;
	winner: string;
	/** Missing where the source publishes no turnout, as before 2021. */
	turnout?: number;
	votes: PartyVotes;
};

export type WardElections = {
	latest: WardResult;
	/** Earlier winners under the same ward code, newest first. */
	earlier: [year: number, winner: string][];
};

export type CouncilElection = {
	year: number;
	/** The council's wards with a result that year. */
	wards: number;
	/** Wards won, by party, most first. */
	won: [party: string, wards: number][];
	/** Percentage share of the votes counted, by party, largest first. */
	share: [party: string, percent: number][];
};

export type PlaceElections = {
	wards: Record<string, WardElections>;
	/** Newest election first. */
	councils: Record<string, CouncilElection[]>;
};

type SourceRow = {
	ladCode?: string;
	turnoutPercent?: number;
	partyVotes: Record<string, number>;
};

export type SourceEdition = {
	year: number;
	results?: Record<string, string>;
	data: Record<string, SourceRow>;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

const isCouncilCode = (code: string | undefined): code is string =>
	!!code && /^[EWSN]\d{8}$/.test(code);

const sortedVotes = (votes: Record<string, number>): PartyVotes =>
	Object.entries(votes)
		.filter(([, count]) => Number.isFinite(count) && count > 0)
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

/**
 * Every ward's and council's results from the dataset's editions. A ward's
 * council is the one the source gives, else the ward lookup's, as some
 * years' sources give none.
 */
export function compilePlaceElections(
	editions: readonly SourceEdition[],
	wardToLad: Readonly<Record<string, string>>,
): PlaceElections {
	const newestFirst = [...editions].sort((a, b) => b.year - a.year);
	const wards: Record<string, WardElections> = {};
	const councils: Record<string, CouncilElection[]> = {};

	for (const edition of newestFirst) {
		const byCouncil = new Map<
			string,
			{
				wards: number;
				won: Map<string, number>;
				votes: Map<string, number>;
			}
		>();
		for (const [code, row] of Object.entries(edition.data)) {
			const votes = sortedVotes(row.partyVotes ?? {});
			const winner = edition.results?.[code] ?? votes[0]?.[0];
			if (!winner || votes.length === 0) continue;

			const known = wards[code];
			if (known) known.earlier.push([edition.year, winner]);
			else {
				const latest: WardResult = {
					year: edition.year,
					winner,
					votes,
				};
				if (
					typeof row.turnoutPercent === "number" &&
					row.turnoutPercent > 0
				)
					latest.turnout = round1(row.turnoutPercent);
				wards[code] = { latest, earlier: [] };
			}

			// The source's own code is the council of the day; the lookup's
			// is today's, which would credit a merged council's predecessors'
			// elections to it.
			const council = isCouncilCode(row.ladCode)
				? row.ladCode
				: wardToLad[code];
			if (!council) continue;
			let totals = byCouncil.get(council);
			if (!totals) {
				totals = { wards: 0, won: new Map(), votes: new Map() };
				byCouncil.set(council, totals);
			}
			totals.wards += 1;
			totals.won.set(winner, (totals.won.get(winner) ?? 0) + 1);
			for (const [party, count] of votes)
				totals.votes.set(party, (totals.votes.get(party) ?? 0) + count);
		}

		for (const [council, totals] of byCouncil) {
			const counted = [...totals.votes.values()].reduce(
				(sum, count) => sum + count,
				0,
			);
			(councils[council] ??= []).push({
				year: edition.year,
				wards: totals.wards,
				won: [...totals.won].sort(
					(a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
				),
				share: [...totals.votes]
					.map(([party, count]): [string, number] => [
						party,
						round1((count / counted) * 100),
					])
					.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
			});
		}
	}
	return { wards, councils };
}

let compiled: Promise<PlaceElections | null> | undefined;

/** The compiled results, or null where the build has not written them. */
function loadPlaceElections() {
	compiled ??= import("@/public/data/datasets/place-elections.json")
		.then((module) => module.default as unknown as PlaceElections)
		.catch(() => null);
	return compiled;
}

export async function wardElections(code: string) {
	return (await loadPlaceElections())?.wards[code];
}

export async function councilElections(code: string) {
	return (await loadPlaceElections())?.councils[code];
}
