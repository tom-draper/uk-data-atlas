// lib/data/generalElectionConfig.ts

import { withCDN } from "@/lib/helpers/cdn";
import { ConstituencyYear } from "../../boundaries/boundaries";

export type GeneralElectionSourceConfig = {
	year: ConstituencyYear;
	url: string;
	// Flag to handle the unique header cleaning logic for the 2024 CSV file
	requiresHeaderCleaning: boolean;
	// The year of the boundary GeoJSON file corresponding to this election data
	constituencyBoundaryYear: 2024 | 2019;
	fields: {
		onsId: string;
		constituencyName: string;
		regionName: string;
		countryName: string;
		firstParty: string;
		otherCandidates: string;
		majority: string;
		electorate: string;
		validVotes: string;
		invalidVotes: string;
		// The list of party columns to iterate over
		partyColumns: string[];
	};
};

export const KNOWN_PARTIES_2024 = [
	"Con",
	"Lab",
	"LD",
	"RUK",
	"Green",
	"SNP",
	"PC",
	"DUP",
	"SF",
	"SDLP",
	"UUP",
	"APNI",
];
export const KNOWN_PARTIES_PRE_2024 = [
	"Con",
	"Lab",
	"LD",
	"BRX",
	"Green",
	"SNP",
	"PC",
	"DUP",
	"SF",
	"SDLP",
	"UUP",
	"APNI",
	"UKIP",
];

export const GENERAL_ELECTION_SOURCES: Record<
	string,
	GeneralElectionSourceConfig
> = {
	"general-election-2024": {
		year: 2024,
		url: withCDN(
			"/data/elections/general-elections/HoC-GE2024-results-by-constituency.csv",
		),
		requiresHeaderCleaning: true, // Need to skip initial metadata rows
		constituencyBoundaryYear: 2024,
		fields: {
			onsId: "ONS ID",
			constituencyName: "Constituency name",
			regionName: "Region name",
			countryName: "Country name",
			firstParty: "First party",
			otherCandidates: "All other candidates",
			majority: "Majority",
			electorate: "Electorate",
			validVotes: "Valid votes",
			invalidVotes: "Invalid votes",
			partyColumns: KNOWN_PARTIES_2024,
		},
	},
	"general-election-2019": {
		year: 2019,
		url: withCDN(
			"/data/elections/general-elections/HoC-GE2019-results-by-constituency.csv",
		),
		requiresHeaderCleaning: false,
		constituencyBoundaryYear: 2019,
		fields: {
			onsId: "ONS ID",
			constituencyName: "Constituency name",
			regionName: "Region name",
			countryName: "Country name",
			firstParty: "First party",
			otherCandidates: "All other candidates",
			majority: "Majority",
			electorate: "Electorate",
			validVotes: "Valid votes",
			invalidVotes: "Invalid votes",
			partyColumns: KNOWN_PARTIES_PRE_2024,
		},
	},
	"general-election-2017": {
		year: 2017,
		url: withCDN(
			"/data/elections/general-elections/HoC-GE2017-results-by-constituency.csv",
		),
		requiresHeaderCleaning: false,
		constituencyBoundaryYear: 2019, // Re-use 2019 boundaries for 2017/2015
		fields: {
			onsId: "ONS ID",
			constituencyName: "Constituency name",
			regionName: "Region name",
			countryName: "Country name",
			firstParty: "First party",
			otherCandidates: "All other candidates",
			majority: "Majority",
			electorate: "Electorate",
			validVotes: "Valid votes",
			invalidVotes: "Invalid votes",
			partyColumns: KNOWN_PARTIES_PRE_2024,
		},
	},
	"general-election-2015": {
		year: 2015,
		url: withCDN(
			"/data/elections/general-elections/HoC-GE2015-results-by-constituency.csv",
		),
		requiresHeaderCleaning: false,
		constituencyBoundaryYear: 2019, // Re-use 2019 boundaries for 2017/2015
		fields: {
			onsId: "ONS ID",
			constituencyName: "Constituency name",
			regionName: "Region name",
			countryName: "Country name",
			firstParty: "First party",
			otherCandidates: "All other candidates",
			majority: "Majority",
			electorate: "Electorate",
			validVotes: "Valid votes",
			invalidVotes: "Invalid votes",
			partyColumns: KNOWN_PARTIES_PRE_2024,
		},
	},
};
