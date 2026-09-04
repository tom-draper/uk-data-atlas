// lib/data/electionConfig.ts

import { WardYear } from "../../boundaries/boundaries";

interface ElectionSourceBase {
	year: number;
	boundaryYear?: WardYear; // Defaults to year; set when election year has no ward boundary
	// Path relative to data/, read at precompile time. The leading segments
	// are the dataset's id, so this points into its folder alongside meta.json.
	path: string;
	isReference?: boolean; // Used to fix 2023 data
}

export interface ElectionTableSourceConfig extends ElectionSourceBase {
	source: "xlsx";
	// Worksheet inside the workbook holding the ward-level table.
	sheet: string;
	// Map internal standard keys to worksheet table headers.
	fields: {
		code: string; // Ward Code
		name: string; // Ward Name
		ladName: string;
		ladCode?: string; // Optional, 2023 might not have it
		turnout: string;
		electorate: string;
		totalVotes?: string; // 2023 uses 'Grand Total'
	};
	// Remap ward codes in source data to match the boundary file for that year
	wardCodeMap?: Record<string, string>;
}

export interface LeapElectionSourceConfig extends ElectionSourceBase {
	source: "leap";
}

export type ElectionSourceConfig =
	| ElectionTableSourceConfig
	| LeapElectionSourceConfig;

export const ELECTION_SOURCES: Record<string, ElectionSourceConfig> = {
	2025: {
		year: 2025,
		source: "xlsx",
		boundaryYear: 2025, // 2025 HoC data uses WD25CD codes from the May 2025 ward boundary
		path: "politics/elections/local-elections/2025/LEH-2025-results-HoC.xlsx",
		sheet: "Ward results",
		isReference: true,
		fields: {
			code: "ONS ward code",
			name: "Ward/ County Electoral District name",
			ladName: "Lower tier authority",
			turnout: "Valid vote turnout (HoC method)",
			electorate: "Electorate",
			totalVotes: "Ballots",
		},
	},
	2024: {
		year: 2024,
		source: "xlsx",
		path: "politics/elections/local-elections/2024/LEH-2024-results-HoC-version.xlsx",
		sheet: "Wards results",
		isReference: true,
		fields: {
			code: "Ward code",
			name: "Ward name",
			ladName: "Local authority name",
			ladCode: "Local authority code",
			turnout: "Turnout (%)",
			electorate: "Electorate",
			totalVotes: "Total votes",
		},
	},
	2023: {
		year: 2023,
		source: "xlsx",
		path: "politics/elections/local-elections/2023/LEH-Candidates-2023.xlsx",
		sheet: "Ward_Level",
		isReference: false,
		fields: {
			code: "", // Missing in 2023
			name: "WARDNAME",
			ladName: "DISTRICTNAME", // handled in parser logic
			turnout: "TURNOUT",
			electorate: "ELECT",
			totalVotes: "Grand Total",
		},
	},
	2022: {
		year: 2022,
		source: "xlsx",
		path: "politics/elections/local-elections/2022/local-elections-2022.xlsx",
		sheet: "Wards-results",
		isReference: true,
		fields: {
			code: "Ward code",
			name: "Ward name",
			ladName: "Local authority name",
			ladCode: "Local authority code",
			turnout: "Turnout (%)",
			electorate: "Electorate",
			totalVotes: "Total votes",
		},
	},
	2021: {
		year: 2021,
		source: "xlsx",
		path: "politics/elections/local-elections/2021/local_elections_2021_results-2.xlsx",
		sheet: "Wards-results",
		isReference: true,
		fields: {
			code: "Ward/ED code",
			name: "Ward/ED name",
			ladName: "Local authority name",
			ladCode: "Local authority code",
			turnout: "Turnout (%)",
			electorate: "Electorate",
			totalVotes: "Total votes",
		},
		// The HoC dataset uses post-2022 ward codes for some areas that had boundary
		// reviews. Remap to their Dec 2021 boundary equivalents so they match the map.
		wardCodeMap: {
			E05013874: "E05002328", // Park (Reading)
			E05013955: "E05004793", // Harpenden West
			E05013963: "E05004802", // Sopwell
			E05014120: "E05000916", // Billinge & Seneley Green
			E05014136: "E05001150", // West Park
			E05014147: "E05004541", // Lee East
			E05014148: "E05004542", // Lee West
			E05014152: "E05000670", // Besses (Bury)
			E05014156: "E05000674", // Holyrood (Bury)
			E05014159: "E05000677", // Pilkington Park (Bury)
			E05014163: "E05000681", // Ramsbottom (Bury)
		},
	},
	2019: {
		year: 2019,
		source: "leap",
		path: "politics/elections/local-elections/2019/leap-2019-05-02.zip",
		isReference: true,
	},
	2018: {
		year: 2018,
		source: "leap",
		path: "politics/elections/local-elections/2018/leap-2018-05-03.zip",
		isReference: true,
	},
	2017: {
		year: 2017,
		source: "leap",
		path: "politics/elections/local-elections/2017/leap-2017-05-04.zip",
		isReference: true,
	},
	2016: {
		year: 2016,
		source: "leap",
		path: "politics/elections/local-elections/2016/leap-2016-05-05.zip",
		isReference: true,
	},
};
