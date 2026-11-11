import { GENERAL_POLLING_DAYS } from "@uk-data-atlas/datasets";
import { PARTIES, PARTY_INFO } from "@uk-data-atlas/datasets";
import { calculateTurnout } from "@uk-data-atlas/datasets";
import {
	type DeclaredDataset,
	type DeclaredDimension,
	type DeclaredField,
	type DeclaredHeader,
	type DeclaredRelease,
	periods,
} from "../declaredStatistics.ts";
import type { StatisticsParty } from "../atlasStatistics.ts";
import {
	ELECTORATE,
	PARTY_VOTES,
	REJECTED_BALLOTS,
	TURNOUT,
	VALID_VOTES,
	measure,
} from "./measures.ts";

/** Election results, one part per election and one contest per record. */

const PARTY: DeclaredDimension = {
	slug: "party",
	label: "Party",
	members: PARTY_INFO.map(({ key, name }) => ({ key, label: name })),
};

/** The parties the atlas names, with the colour it draws each in. */
const PARTY_REFERENCE: StatisticsParty[] = PARTY_INFO.map(({ key, name }) => ({
	key,
	name,
	colour: (PARTIES as Record<string, { color: string } | undefined>)[key]
		?.color,
}));

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
	module: "politics",
	payload: {
		parts: () =>
			Object.keys(LOCAL_POLLING_DAYS).map((key) => ({
				key,
				header: {
					id: `localElection${key}`,
					type: "localElection",
					year: Number(key),
					boundaryYear: Number(key),
					boundaryType: "ward",
					// Only 2023's results name their wards, not code them.
					wardCodes: key === "2023" ? "name-matched" : "published",
					partyInfo: PARTY_INFO.map((party) => ({ ...party })),
					coverageCountries: ["GB-ENG", "GB-WLS"],
				},
			})),
		code: "wardCode",
		/** A party that did not stand has no entry. */
		omitMissing: ["partyVotes."],
		/** Wards the source lists that the atlas could not place. */
		dropped: ["excludedWards"],
	},
	period: (key) => periods.date(pollingDay(LOCAL_POLLING_DAYS)(key)),
	alsoIn: (header) => [
		...nearest(DIVISION_YEARS, Number(header.year)).map(division),
		...nearest(WARD_YEARS, Number(header.year)).map(ward),
	],
	/** The code a ward was published under, where it is not the ward's own. */
	parents: [
		{
			relation: "published-as",
			code: "sourceWardCode",
			release: ward(2022),
			alsoIn: nearest(WARD_YEARS, 2022).map(ward),
		},
	],
	election: {
		kind: "local",
		date: pollingDay(LOCAL_POLLING_DAYS),
		results: "results",
		parties: PARTY_REFERENCE,
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
	computed: {
		totalVotes: sumPartyVotes,
		electorate: () => 0,
		turnoutPercent: () => 0,
	},
};

/** Polling days of the general elections, by year. */
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
	module: "politics",
	payload: {
		parts: () =>
			Object.keys(GENERAL_POLLING_DAYS).map((key) => ({
				key,
				header: {
					id: `generalElection-${key}`,
					type: "generalElection",
					year: Number(key),
					// Results to 2019 sit on the 2019 constituencies.
					boundaryYear: Number(key) === 2024 ? 2024 : 2019,
					boundaryType: "constituency",
					partyInfo: PARTY_INFO.map((party) => ({ ...party })),
				},
			})),
		code: "onsId",
		/** A party that did not stand has no entry. */
		omitMissing: ["partyVotes."],
	},
	period: (key) => periods.date(pollingDay(GENERAL_POLLING_DAYS)(key)),
	/** The election's own year; the header names the last year of a boundary set. */
	release: (header) => ({
		geography: "constituency",
		year: Number(header.year),
	}),
	election: {
		kind: "general",
		date: pollingDay(GENERAL_POLLING_DAYS),
		results: "results",
		parties: PARTY_REFERENCE,
		areas: { region: "region", country: "country" },
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
	computed: {
		turnoutPercent: (record) =>
			calculateTurnout(
				record.validVotes as number,
				record.invalidVotes as number,
				record.electorate as number,
			) ?? 0,
	},
};
