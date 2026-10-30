import { PARTY_INFO } from "@uk-data-atlas/datasets/data/election/parties";
import { historicalConstituencyCode } from "@uk-data-atlas/datasets/data/historical-general-election/constituencies";
import { calculateTurnout } from "@uk-data-atlas/datasets/helpers/turnout";
import {
	type DeclaredDataset,
	type DeclaredDimension,
	type DeclaredField,
	type DeclaredHeader,
	type DeclaredRelease,
	periods,
} from "../declaredStatistics";
import {
	ELECTORATE,
	REJECTED_BALLOTS,
	TURNOUT,
	VALID_VOTES,
	measure,
} from "./measures";

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

/** Polling days of the general elections, by year. */
const GENERAL_POLLING_DAYS: Readonly<Record<string, string>> = {
	2010: "2010-05-06",
	2015: "2015-05-07",
	2017: "2017-06-08",
	2019: "2019-12-12",
	2024: "2024-07-04",
};

const MAJORITY = measure(
	"majority",
	"Majority",
	"votes",
	"count",
	"none",
	"Votes by which the winning candidate led the runner-up.",
);

export const GENERAL_ELECTION: DeclaredDataset = {
	type: "generalElection",
	period: (key) => periods.date(pollingDay(GENERAL_POLLING_DAYS)(key)),
	/** The election's own year; the header names the last year of a boundary set. */
	release: (header) => ({
		geography: "constituency",
		year: Number(header.year),
	}),
	election: {
		kind: "general",
		date: pollingDay(GENERAL_POLLING_DAYS),
		contest: {
			area_name: "constituencyName",
			region: "regionName",
			country: "countryName",
			constituency_type: "constituencyType",
			result: "result",
			first_party: "firstParty",
			second_party: "secondParty",
		},
		elected: {
			given_name: "memberFirstName",
			family_name: "memberSurname",
			gender: "memberGender",
		},
	},
	measures: [
		PARTY_VOTES,
		ELECTORATE,
		VALID_VOTES,
		REJECTED_BALLOTS,
		MAJORITY,
		TURNOUT,
	],
	dimensions: [PARTY],
	fields: [
		{ path: "partyVotes.{party}", measure: "party-votes" },
		{ path: "electorate", measure: "electorate" },
		{ path: "validVotes", measure: "valid-votes" },
		{ path: "invalidVotes", measure: "rejected-ballots" },
		{ path: "majority", measure: "majority" },
	],
	derived: {
		turnoutPercent:
			"Valid and rejected ballots as a percentage of the electorate.",
	},
	rebuild: {
		derived: {
			turnoutPercent: (record) =>
				calculateTurnout(
					record.validVotes as number,
					record.invalidVotes as number,
					record.electorate as number,
				) ?? 0,
		},
	},
};

/** Polling days of the general elections from 1918 to 2019, by election. */
const HISTORICAL_POLLING_DAYS: Readonly<Record<string, string>> = {
	1918: "1918-12-14",
	1922: "1922-11-15",
	1923: "1923-12-06",
	1924: "1924-10-29",
	1929: "1929-05-30",
	1931: "1931-10-27",
	1935: "1935-11-14",
	1945: "1945-07-05",
	1950: "1950-02-23",
	1951: "1951-10-25",
	1955: "1955-05-26",
	1959: "1959-10-08",
	1964: "1964-10-15",
	1966: "1966-03-31",
	1970: "1970-06-18",
	"1974F": "1974-02-28",
	"1974O": "1974-10-10",
	1979: "1979-05-03",
	1983: "1983-06-09",
	1987: "1987-06-11",
	1992: "1992-04-09",
	1997: "1997-05-01",
	2001: "2001-06-07",
	2005: "2005-05-05",
	...GENERAL_POLLING_DAYS,
};

/** The House of Commons Library's five broad party groups. */
const PARTY_GROUP: DeclaredDimension = {
	slug: "party-group",
	label: "Party group",
	members: [
		{ key: "CON", label: "Conservative" },
		{
			key: "LIB",
			label: "Liberal, SDP-Liberal Alliance and Liberal Democrat",
		},
		{ key: "LAB", label: "Labour" },
		{ key: "NAT", label: "Scottish and Welsh nationalist" },
		{ key: "OTHER", label: "Other" },
	],
};

const SEATS = measure(
	"seats",
	"Seats",
	"seats",
	"count",
	"sum",
	"Members the constituency returned to Parliament.",
);

const PARTY_VOTE_SHARE = measure(
	"party-vote-share",
	"Party vote share",
	"percent",
	"share",
	"ratio",
	"Votes for a party as a percentage of valid votes.",
	{ numerator: "party-votes", denominator: "valid-votes" },
);

/** From 2010 the Library uses ONS codes; before, its own ids per boundary set. */
const onOnsCodes = (header: DeclaredHeader) =>
	String(header.boundarySet).startsWith("2010");

export const HISTORICAL_GENERAL_ELECTION: DeclaredDataset = {
	type: "historicalGeneralElection",
	period: (key) => periods.date(pollingDay(HISTORICAL_POLLING_DAYS)(key)),
	release: (header) =>
		onOnsCodes(header)
			? { geography: "constituency", year: Number(header.year) }
			: {
					geography: "historicalConstituency",
					year: Number(String(header.boundarySet).split("-")[0]),
				},
	keys: (key, header) =>
		onOnsCodes(header)
			? key
			: historicalConstituencyCode(String(header.boundarySet), key),
	election: {
		kind: "general",
		date: pollingDay(HISTORICAL_POLLING_DAYS),
		contest: { area_name: "constituencyName", region: "region" },
	},
	measures: [
		PARTY_VOTES,
		VALID_VOTES,
		PARTY_VOTE_SHARE,
		SEATS,
		ELECTORATE,
		TURNOUT,
	],
	dimensions: [PARTY_GROUP],
	fields: [
		{ path: "seats", measure: "seats" },
		{ path: "electorate", measure: "electorate" },
		{ path: "votes.{party-group}", measure: "party-votes" },
		{ path: "voteShare.{party-group}", measure: "party-vote-share" },
		{ path: "totalVotes", measure: "valid-votes" },
		{ path: "turnoutPercent", measure: "turnout" },
	],
	rebuild: {},
};
