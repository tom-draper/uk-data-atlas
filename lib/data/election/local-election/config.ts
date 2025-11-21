// lib/data/electionConfig.ts

import { WardYear } from "../../boundaries/boundaries";

export interface ElectionSourceConfig {
    year: WardYear;
    url: string;
    // Map internal standard keys to CSV headers
    fields: {
        code: string; // Ward Code
        name: string; // Ward Name
        laName: string;
        laCode?: string; // Optional, 2023 might not have it
        turnout: string;
        electorate: string;
        totalVotes?: string; // 2023 uses 'Grand Total'
    };
    skipRows?: number; // Some files have metadata headers
    isReference?: boolean; // Used to fix 2023 data
}

export const ELECTION_SOURCES: Record<string, ElectionSourceConfig> = {
    2024: {
        year: 2024,
        url: '/data/elections/local-elections/LEH-2024-results-HoC-version/Wards results-Table 1.csv',
        isReference: true,
        fields: {
            code: 'Ward code',
            name: 'Ward name',
            laName: 'Local authority name',
            laCode: 'Local authority code',
            turnout: 'Turnout (%)',
            electorate: 'Electorate',
            totalVotes: 'Total votes'
        }
    },
    2023: {
        year: 2023,
        url: '/data/elections/local-elections/LEH-Candidates-2023/Ward_Level-Table 1.csv',
        isReference: false,
        fields: {
            code: '', // Missing in 2023
            name: 'WARDNAME',
            laName: 'DISTRICTNAME', // Or COUNTYNAME, handled in parser logic
            turnout: 'TURNOUT',
            electorate: 'ELECT',
            totalVotes: 'Grand Total'
        }
    },
    2022: {
        year: 2022,
        url: '/data/elections/local-elections/local-elections-2022/Wards-results-Table 1.csv',
        isReference: true,
        fields: {
            code: 'Ward code',
            name: 'Ward name',
            laName: 'Local authority name',
            laCode: 'Local authority code',
            turnout: 'Turnout (%)',
            electorate: 'Electorate',
            totalVotes: 'Total votes'
        }
    },
    2021: {
        year: 2021,
        url: '/data/elections/local-elections/local_elections_2021_results-2/Wards-results-Table 1.csv',
        isReference: true,
        fields: {
            code: 'Ward/ED code',
            name: 'Ward/ED name',
            laName: 'Local authority name',
            laCode: 'Local authority code',
            turnout: 'Turnout (%)',
            electorate: 'Electorate',
            totalVotes: 'Total votes'
        }
    }
};