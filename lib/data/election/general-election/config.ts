// lib/data/generalElectionConfig.ts

import { ConstituencyYear } from "../../boundaries/boundaries";
import type { GeneralElectionYear } from "@lib/types";

export type GeneralElectionSourceConfig = {
	year: GeneralElectionYear;
	// Path relative to public/data/, read at precompile time
	path: string;
	// Flag to handle the unique header cleaning logic for the 2024 CSV file
	requiresHeaderCleaning: boolean;
	// The year of the boundary GeoJSON file corresponding to this election data
	constituencyBoundaryYear: ConstituencyYear;
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
		/** Maps a source header to the party key used by the atlas. */
		partyColumnAliases?: Record<string, string>;
	};
};

const KNOWN_PARTIES_2024 = [
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
const KNOWN_PARTIES_PRE_2024 = [
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
const KNOWN_PARTIES_2010 = [
	"Con",
	"Lab",
	"LD",
	"UKIP",
	"Green",
	"SNP",
	"PC",
	"DUP",
	"SF",
	"SDLP",
	"UUP (as UCUNF)",
	"APNI",
];

export const GENERAL_ELECTION_SOURCES: Record<
	string,
	GeneralElectionSourceConfig
> = {
	"general-election-2010": {
		year: 2010,
		path: "politics/elections/general-elections/2010/HoC-GE2010-results-by-constituency.csv",
		requiresHeaderCleaning: false,
		constituencyBoundaryYear: 2010,
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
			partyColumns: KNOWN_PARTIES_2010,
			partyColumnAliases: { "UUP (as UCUNF)": "UUP" },
		},
	},
	"general-election-2024": {
		year: 2024,
		path: "politics/elections/general-elections/2024/HoC-GE2024-results-by-constituency.csv",
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
		path: "politics/elections/general-elections/2019/HoC-GE2019-results-by-constituency.csv",
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
		path: "politics/elections/general-elections/2017/HoC-GE2017-results-by-constituency.csv",
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
		path: "politics/elections/general-elections/2015/HoC-GE2015-results-by-constituency.csv",
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
