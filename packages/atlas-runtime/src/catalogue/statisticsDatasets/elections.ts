import { PARTY_INFO } from "@uk-data-atlas/datasets/data/election/parties";
import {
	type DeclaredDataset,
	type DeclaredDimension,
	type DeclaredField,
	type DeclaredRelease,
	periods,
} from "../declaredStatistics";
import { ELECTORATE, TURNOUT, measure } from "./measures";

/** Election results, one part per election and one contest per record. */

const PARTY: DeclaredDimension = {
	slug: "party",
	label: "Party",
	members: PARTY_INFO.map(({ key, name }) => ({ key, label: name })),
};

const PARTY_VOTES = measure(
	"party-votes",
	"Party votes",
	"votes",
	"count",
	"sum",
	"Votes for a party's candidates. Where a ward elects several councillors, the votes of the party's highest-polling candidate, so each voter counts once.",
);

/** Polling days of the local elections, by year. */
const LOCAL_POLLING_DAYS: Readonly<Record<string, string>> = {
	2016: "2016-05-05",
	2017: "2017-05-04",
	2018: "2018-05-03",
	2019: "2019-05-02",
	2021: "2021-05-06",
	2022: "2022-05-05",
	2023: "2023-05-04",
	2024: "2024-05-02",
	2025: "2025-05-01",
};

const pollingDay =
	(days: Readonly<Record<string, string>>) => (key: string) => {
		const day = days[key];
		if (!day) throw new Error(`No polling day for election ${key}`);
		return day;
	};

const ward = (year: number): DeclaredRelease => ({ geography: "ward", year });
const division = (year: number): DeclaredRelease => ({
	geography: "countyElectoralDivision",
	year,
});

const WARD_YEARS = [
	2011, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
	2026,
];
const DIVISION_YEARS = [2017, 2023, 2025];

/**
 * Years to try for an election in `year`: the latest at or before it first,
 * then earlier ones, then later ones, so each code is placed on the release
 * nearest the election that has it.
 */
const nearest = (years: readonly number[], year: number) => [
	...years.filter((candidate) => candidate <= year).reverse(),
	...years.filter((candidate) => candidate > year),
];

const sumPartyVotes = (record: Record<string, unknown>) =>
	Object.values(record.partyVotes as Record<string, number>).reduce(
		(total, votes) => total + votes,
		0,
	);

export const LOCAL_ELECTION: DeclaredDataset = {
	type: "localElection",
	period: (key) => periods.date(pollingDay(LOCAL_POLLING_DAYS)(key)),
	alsoIn: (header) => [
		...nearest(DIVISION_YEARS, Number(header.year)).map(division),
		...nearest(WARD_YEARS, Number(header.year)).map(ward),
	],
	/** The code a ward was published under, where it is not the ward's own. */
	parents: [
		{
			code: "sourceWardCode",
			release: ward(2022),
			alsoIn: nearest(WARD_YEARS, 2022).map(ward),
		},
	],
	election: {
		kind: "local",
		date: pollingDay(LOCAL_POLLING_DAYS),
		contest: {
			area_name: "wardName",
			authority_code: "ladCode",
			authority_name: "ladName",
		},
	},
	measures: [PARTY_VOTES, ELECTORATE, TURNOUT],
	dimensions: [PARTY],
	fields: (key) => [
		{ path: "partyVotes.{party}", measure: "party-votes" },
		// LEAP, the source to 2019, publishes no electorate or turnout.
		...(Number(key) >= 2021
			? ([
					{ path: "electorate", measure: "electorate" },
					{ path: "turnoutPercent", measure: "turnout" },
				] satisfies DeclaredField[])
			: []),
	],
	derived: {
		totalVotes: "The sum of the party votes.",
		electorate: "0 where the source publishes no electorate.",
		turnoutPercent: "0 where the source publishes no turnout.",
	},
	rebuild: {
		derived: {
			totalVotes: sumPartyVotes,
			electorate: () => 0,
			turnoutPercent: () => 0,
		},
	},
};
