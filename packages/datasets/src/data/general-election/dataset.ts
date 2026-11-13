import type { GeneralElectionDataset } from "../../types/elections.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import {
	ELECTORATE,
	PARTY_VOTES,
	REJECTED_BALLOTS,
	TURNOUT,
	VALID_VOTES,
	measure,
} from "../../declaration/measures.ts";
import { periods } from "../../declaration/statistics.ts";
import { calculateTurnout } from "../../helpers/turnout.ts";
import { loadGeneralElection } from "../election/general-election/load.ts";
import {
	PARTY,
	PARTY_REFERENCE,
	partyInfoCopy,
} from "../election/partyStatistics.ts";
import { GENERAL_POLLING_DAYS, pollingDay } from "../election/pollingDays.ts";

const MAJORITY = measure(
	"majority",
	"Majority",
	"votes",
	"count",
	"none",
	"Votes by which the winning candidate led the runner-up.",
);

export const generalElection = defineDataset<GeneralElectionDataset>({
	id: "general-election",
	topic: "general-elections",
	boundary: { type: "constituency", year: 2024 },
	source: {
		name: "General Election Results",
		publisher: "House of Commons Library",
		sourceUrl: "https://commonslibrary.parliament.uk/",
		year: "2010, 2015, 2017, 2019, 2024",
		licence: "Open Parliament Licence",
		licenceUrl:
			"https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/",
		attribution:
			"House of Commons Library. Licensed under the Open Parliament Licence.",
		description: "General election results by parliamentary constituency.",
		cadence: "irregular",
		notes: [],
	},
	load: async ({ text }) => loadGeneralElection(text),
	statistics: {
		payload: {
			parts: () =>
				Object.keys(GENERAL_POLLING_DAYS).map((key) => ({
					key,
					header: {
						id: `general-election-${key}`,
						type: "general-election",
						year: Number(key),
						// Results to 2019 sit on the 2019 constituencies.
						boundaryYear: Number(key) === 2024 ? 2024 : 2019,
						boundaryType: "constituency",
						partyInfo: partyInfoCopy(),
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
	},
});
