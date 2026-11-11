import type { HistoricalGeneralElectionDataset } from "../../types/historicalGeneralElection.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import {
	ELECTORATE,
	PARTY_VOTES,
	TURNOUT,
	VALID_VOTES,
	measure,
} from "../../declaration/measures.ts";
import {
	periods,
	type DeclaredDimension,
	type DeclaredHeader,
} from "../../declaration/statistics.ts";
import { historicalConstituencyCode } from "./constituencies.ts";
import { loadHistoricalGeneralElection } from "./loader.ts";

const pollingDay =
	(days: Readonly<Record<string, string>>) => (key: string) => {
		const day = days[key];
		if (!day) throw new Error(`No polling day for election ${key}`);
		return day;
	};
export const GENERAL_POLLING_DAYS: Readonly<Record<string, string>> = {
	2010: "2010-05-06",
	2015: "2015-05-07",
	2017: "2017-06-08",
	2019: "2019-12-12",
	2024: "2024-07-04",
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

/** The set of constituency boundaries each election was held on. */
const BOUNDARY_SETS: Readonly<Record<string, string>> = {
	"1918": "1918-1935",
	"1922": "1918-1935",
	"1923": "1918-1935",
	"1924": "1918-1935",
	"1929": "1918-1935",
	"1931": "1918-1935",
	"1935": "1918-1935",
	"1945": "1945",
	"1950": "1950-1951",
	"1951": "1950-1951",
	"1955": "1955-1970",
	"1959": "1955-1970",
	"1964": "1955-1970",
	"1966": "1955-1970",
	"1970": "1955-1970",
	"1974F": "1974-1979",
	"1974O": "1974-1979",
	"1979": "1974-1979",
	"1983": "1983-1992",
	"1987": "1983-1992",
	"1992": "1983-1992",
	"1997": "1997-2001",
	"2001": "1997-2001",
	"2005": "2005",
	"2010": "2010-2017",
	"2015": "2010-2017",
	"2017": "2010-2019",
	"2019": "2010-2019",
};

export const historicalGeneralElection =
	defineDataset<HistoricalGeneralElectionDataset>({
		id: "historical-general-election",
		module: "politics",
		boundary: { type: "constituency", year: 2019 },
		chartPending: true,
		source: {
			name: "General Election Results, 1918-2019",
			publisher: "House of Commons Library",
			sourceUrl:
				"https://commonslibrary.parliament.uk/research-briefings/cbp-8647/",
			year: "1918-2019",
			licence: "Open Parliament Licence",
			licenceUrl:
				"https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/",
			attribution:
				"House of Commons Library. Licensed under the Open Parliament Licence.",
			description:
				"General election results by constituency for every UK general election from 1918 to 2019, aggregated to broad Conservative/Liberal/Labour/Nationalist/Other vote shares.",
			cadence: "discontinued",
			notes: [],
		},
		ingestion: {
			minimumDatasets: 28,
			requiredDataFields: ["constituencyName", "votes"],
		},
		load: async ({ text }) => loadHistoricalGeneralElection(text),
		statistics: {
			payload: {
				parts: () =>
					Object.keys(HISTORICAL_POLLING_DAYS)
						// The 2024 election is in the general election dataset.
						.filter((key) => key !== "2024")
						.map((key) => ({
							key,
							header: {
								id: `historical-general-election-${key}`,
								type: "historical-general-election",
								election: key,
								year: Number(key.slice(0, 4)),
								boundaryType: "constituency",
								boundaryYear: Number(key.slice(0, 4)),
								boundarySet: BOUNDARY_SETS[key],
							},
						})),
				code: "constituencyId",
				/** A party group with no votes has no entry. */
				omitMissing: ["votes.", "voteShare."],
				emptyObjects: ["votes", "voteShare"],
			},
			period: (key) =>
				periods.date(pollingDay(HISTORICAL_POLLING_DAYS)(key)),
			release: (header) =>
				onOnsCodes(header)
					? { geography: "constituency", year: Number(header.year) }
					: {
							geography: "historicalConstituency",
							year: Number(
								String(header.boundarySet).split("-")[0],
							),
						},
			keys: (key, header) =>
				onOnsCodes(header)
					? key
					: historicalConstituencyCode(
							String(header.boundarySet),
							key,
						),
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
				{
					path: "voteShare.{party-group}",
					measure: "party-vote-share",
				},
				{ path: "totalVotes", measure: "valid-votes" },
				{ path: "turnoutPercent", measure: "turnout" },
			],
		},
	});
