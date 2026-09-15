// lib/data/electionConfig.ts

import { WardYear } from "../../boundaries/boundaries";

interface ElectionSourceBase {
	year: number;
	boundaryYear?: WardYear; // Defaults to year; set when election year has no ward boundary
	// Path relative to data/, read at precompile time. The leading segments
	// are the dataset's id, so this points into its folder alongside meta.json.
	path: string;
}

export interface ElectionTableSourceConfig extends ElectionSourceBase {
	source: "xlsx";
	// Worksheet with one row per ward, giving its identity, electorate and
	// turnout. Votes are not read from it.
	sheet: string;
	fields: {
		code?: string; // Absent when the workbook publishes no ward codes
		name: string;
		ladName: string;
		ladCode?: string;
		turnout: string;
		electorate: string;
	};
	// Worksheet with one row per candidate, from which ward votes are counted.
	candidates: {
		sheet: string;
		fields: {
			code?: string;
			name: string;
			ladName: string;
			party: string;
			votes: string;
		};
	};
	// For a workbook without ward codes: the official ward list for the
	// boundary year, whose codes are matched by exact authority and ward name.
	wardList?: {
		path: string;
		code: string;
		name: string;
		ladName: string;
	};
	// Remap ward codes in source data to match the boundary file for that year
	wardCodeMap?: Record<string, string>;
}

export interface LeapElectionSourceConfig extends ElectionSourceBase {
	source: "leap";
}

export type ElectionSourceConfig =
	ElectionTableSourceConfig | LeapElectionSourceConfig;

export const ELECTION_SOURCES: Record<string, ElectionSourceConfig> = {
	2025: {
		year: 2025,
		source: "xlsx",
		boundaryYear: 2025, // 2025 HoC data uses WD25CD codes from the May 2025 ward boundary
		path: "politics/elections/local-elections/2025/LEH-2025-results-HoC.xlsx",
		sheet: "Ward results",
		fields: {
			code: "ONS ward code",
			name: "Ward/ County Electoral District name",
			ladName: "Lower tier authority",
			turnout: "Valid vote turnout (HoC method)",
			electorate: "Electorate",
		},
		candidates: {
			sheet: "Candidates result",
			fields: {
				code: "ONS ward code",
				name: "Ward/ County Electoral District name",
				ladName: "Lower tier authority",
				party: "Party name",
				votes: "Votes cast",
			},
		},
	},
	2024: {
		year: 2024,
		source: "xlsx",
		path: "politics/elections/local-elections/2024/LEH-2024-results-HoC-version.xlsx",
		sheet: "Wards results",
		fields: {
			code: "Ward code",
			name: "Ward name",
			ladName: "Local authority name",
			ladCode: "Local authority code",
			turnout: "Turnout (%)",
			electorate: "Electorate",
		},
		candidates: {
			sheet: "Candidates results",
			fields: {
				code: "Ward code",
				name: "Ward name",
				ladName: "Local authority name",
				party: "Party name",
				votes: "Votes",
			},
		},
	},
	2023: {
		year: 2023,
		source: "xlsx",
		path: "politics/elections/local-elections/2023/LEH-Candidates-2023.xlsx",
		sheet: "Ward_Level",
		fields: {
			name: "WARDNAME",
			ladName: "DISTRICTNAME",
			turnout: "TURNOUT",
			electorate: "ELECT",
		},
		candidates: {
			sheet: "Cand_Table",
			fields: {
				name: "WARDNAME",
				ladName: "DISTRICTNAME",
				party: "PARTYNAME",
				votes: "VOTE",
			},
		},
		// The workbook publishes no ward codes.
		wardList: {
			path: "boundaries/ward/2023-05-uk-bgc/WD_MAY_2023_UK_BGC_932649178890735580.geojson",
			code: "WD23CD",
			name: "WD23NM",
			ladName: "LAD23NM",
		},
	},
	2022: {
		year: 2022,
		source: "xlsx",
		path: "politics/elections/local-elections/2022/local-elections-2022.xlsx",
		sheet: "Wards-results",
		fields: {
			code: "Ward code",
			name: "Ward name",
			ladName: "Local authority name",
			ladCode: "Local authority code",
			turnout: "Turnout (%)",
			electorate: "Electorate",
		},
		candidates: {
			sheet: "Candidates-results",
			fields: {
				code: "Ward code",
				name: "Ward name",
				ladName: "Local authority name",
				party: "Party name",
				votes: "Votes",
			},
		},
	},
	2021: {
		year: 2021,
		source: "xlsx",
		path: "politics/elections/local-elections/2021/local_elections_2021_results-2.xlsx",
		sheet: "Wards-results",
		fields: {
			code: "Ward/ED code",
			name: "Ward/ED name",
			ladName: "Local authority name",
			ladCode: "Local authority code",
			turnout: "Turnout (%)",
			electorate: "Electorate",
		},
		candidates: {
			sheet: "Candidates-results",
			fields: {
				code: "Ward/ED code",
				name: "Ward/ED name",
				ladName: "Local authority name",
				party: "Party name",
				votes: "Votes",
			},
		},
		// The HoC dataset uses post-2022 ward codes for some areas that had boundary
		// reviews. Remap to their Dec 2021 boundary equivalents so they match the map.
		wardCodeMap: {
			E05013874: "E05002328", // Park (Reading)
			E05013955: "E05004793", // Harpenden West
			E05013963: "E05004802", // Sopwell
			E05014120: "E05000916", // Billinge & Seneley Green
			E05014136: "E05000930", // West Park (St Helens)
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
		path: "politics/elections/local-elections/2019/leap-2019-05-02.csv",
	},
	2018: {
		year: 2018,
		source: "leap",
		path: "politics/elections/local-elections/2018/leap-2018-05-03.csv",
	},
	2017: {
		year: 2017,
		source: "leap",
		path: "politics/elections/local-elections/2017/leap-2017-05-04.csv",
	},
	2016: {
		year: 2016,
		source: "leap",
		path: "politics/elections/local-elections/2016/leap-2016-05-05.csv",
	},
};
