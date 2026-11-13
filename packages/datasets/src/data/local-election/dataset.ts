import type { LocalElectionDataset } from "../../types/elections.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import {
	ELECTORATE,
	PARTY_VOTES,
	TURNOUT,
} from "../../declaration/measures.ts";
import {
	periods,
	type DeclaredField,
	type DeclaredRelease,
} from "../../declaration/statistics.ts";
import { loadLocalElection } from "../election/local-election/load.ts";
import {
	PARTY,
	PARTY_REFERENCE,
	partyInfoCopy,
} from "../election/partyStatistics.ts";
import { LOCAL_POLLING_DAYS, pollingDay } from "../election/pollingDays.ts";

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

export const localElection = defineDataset<LocalElectionDataset>({
	id: "local-election",
	topic: "local-elections",
	boundary: { type: "ward", year: 2025 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
	layout: {
		regionChunks: {
			kind: "regional",
			wardToLadFallback: true,
			locationAggregate: "localElection",
		},
	},
	ingestion: {
		minimumDatasets: 9,
		requiredDataFields: ["wardCode", "wardName", "partyVotes"],
	},
	source: {
		name: "Local Election Results",
		publisher:
			"House of Commons Library (2021–2025); Local Elections Archive Project (2016–2019)",
		sourceUrl: "https://www.andrewteale.me.uk/leap/",
		year: "2016–2019, 2021–2025",
		licence:
			"Open Parliament Licence (2021–2025); CC BY-SA 3.0 (2016–2019)",
		licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
		attribution:
			"House of Commons Library (2021–2025), licensed under the Open Parliament Licence. Local Elections Archive Project (2016–2019), licensed under CC BY-SA 3.0.",
		description:
			"Ward-level local election results for England and Wales. Party votes count each party's highest-polling candidate in a ward, the House of Commons Library's method for vote share in multi-member wards. The 2016–2019 archive has no electorate or turnout, and excludes Scottish STV results. The 2023 workbook has no ward codes, so they are matched by exact name to the ONS May 2023 ward list.",
		cadence: "annual",
		notes: [],
	},
	load: async ({ text, xlsxSheetRows }) =>
		loadLocalElection({ text, xlsxSheetRows }),
	statistics: {
		payload: {
			parts: () =>
				Object.keys(LOCAL_POLLING_DAYS).map((key) => ({
					key,
					header: {
						id: `local-election${key}`,
						type: "local-election",
						year: Number(key),
						boundaryYear: Number(key),
						boundaryType: "ward",
						// Only 2023's results name their wards, not code them.
						wardCodes:
							key === "2023" ? "name-matched" : "published",
						partyInfo: partyInfoCopy(),
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
	},
});
