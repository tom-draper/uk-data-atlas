// lib/hooks/useElectionData.ts
import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { WardData, Dataset } from '@lib/types/index';
import { PARTY_INFO } from '../data/parties';

// Common party abbreviations to look for
const KNOWN_PARTIES = ['LAB', 'CON', 'LD', 'GREEN', 'REF', 'IND'];

// Utility to detect party columns from CSV headers
const detectPartyColumns = (headers: string[]): string[] => {
    return headers.filter(h => {
        const upper = h.toUpperCase().trim();
        return KNOWN_PARTIES.includes(upper);
    });
};

// Utility to parse vote counts efficiently
const parseVotes = (value: any): number => {
    if (!value || value === '') return 0;
    const parsed = parseInt(String(value).replace(/,/g, '').trim());
    return isNaN(parsed) ? 0 : parsed;
};

// Utility to parse turnout percentage
const parseTurnout = (value: any): number | undefined => {
    if (!value || value === '') return undefined;
    const str = String(value).replace('%', '').trim();
    const parsed = parseFloat(str);
    return isNaN(parsed) ? undefined : parsed;
};

// Utility to parse electorate
const parseElectorate = (value: any): number | undefined => {
    if (!value || value === '') return undefined;
    const parsed = parseInt(String(value).replace(/,/g, '').trim());
    return isNaN(parsed) ? undefined : parsed;
};

// Utility to find winning party
const findWinner = (partyVotes: Record<string, number>): string => {
    let maxVotes = 0;
    let winner = 'OTHER';

    for (const [party, votes] of Object.entries(partyVotes)) {
        if (votes > maxVotes) {
            maxVotes = votes;
            winner = party;
        }
    }

    return winner;
};

const parseElection2024 = async (): Promise<Dataset> => {
    const res = await fetch('/data/elections/local-elections/LEH-2024-results-HoC-version/Wards results-Table 1.csv');
    const csvText = await res.text();
    const lines = csvText.split('\n');
    const dataStart = lines.findIndex(line => line.includes('Local authority name'));
    const cleanedCsv = lines.slice(dataStart).join('\n');

    return new Promise((resolve, reject) => {
        Papa.parse(cleanedCsv, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            complete: (results) => {
                const partyColumns = detectPartyColumns(results.meta.fields || []);
                const wardWinners: Record<string, string> = {};
                const allWardData: Record<string, WardData> = {};

                for (const row of results.data as any[]) {
                    const wardCode = row['Ward code']?.trim();
                    if (!wardCode) continue;

                    const partyVotes: Record<string, number> = {};

                    for (const party of partyColumns) {
                        partyVotes[party] = parseVotes(row[party]);
                    }

                    const winner = findWinner(partyVotes);

                    wardWinners[wardCode] = winner;
                    allWardData[wardCode] = {
                        wardName: row['Ward name'] || 'Unknown',
                        localAuthorityName: row['Local authority name'] || 'Unknown',
                        localAuthorityCode: row['Local authority code'] || 'Unknown',
                        turnoutPercent: parseTurnout(row['Turnout (%)']),
                        electorate: parseElectorate(row['Electorate']),
                        totalVotes: parseVotes(row['Total votes']),
                        ...partyVotes
                    };
                }

                resolve({
                    id: '2024',
                    type: 'election',
                    name: 'Local Elections 2024',
                    year: 2024,
                    wardResults: wardWinners,
                    wardData: allWardData,
                    partyInfo: PARTY_INFO
                });
            },
            error: reject
        });
    });
};

const parseCouncil2023 = async (): Promise<Dataset & { unmappedWards?: any }> => {
    const res = await fetch('/data/elections/local-elections/LEH-Candidates-2023/Ward_Level-Table 1.csv');
    const csvText = await res.text();

    return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            complete: (results) => {
                if (!results.data || results.data.length === 0) {
                    console.warn('2023: No data rows found');
                    resolve({
                        id: '2023',
                        type: 'election',
                        name: 'Council Elections 2023',
                        year: 2023,
                        wardResults: {},
                        wardData: {},
                        partyInfo: PARTY_INFO,
                    });
                    return;
                }

                const partyColumns = detectPartyColumns(results.meta.fields || []);
                const unmappedWards: Record<string, any> = {};

                for (const row of results.data as any[]) {
                    if (!row || typeof row !== 'object') continue;

                    const county = String(row.COUNTYNAME || '').trim();
                    const district = String(row.DISTRICTNAME || '').trim();
                    const ward = String(row.WARDNAME || '').trim();

                    if (!ward) continue;

                    const partyVotes: Record<string, number> = {};

                    for (const party of partyColumns) {
                        partyVotes[party] = parseVotes(row[party]);
                    }

                    const winner = findWinner(partyVotes);
                    const maxVotes = Math.max(...Object.values(partyVotes));

                    if (maxVotes > 0) {
                        const nameKey = `${county}|${district}|${ward}`;
                        unmappedWards[nameKey] = {
                            wardName: ward,
                            localAuthorityName: district || county || 'Unknown',
                            districtName: district,
                            countyName: county,
                            winningParty: winner,
                            turnoutPercent: parseTurnout(row['TURNOUT']),
                            electorate: parseElectorate(row['ELECT']),
                            totalVotes: parseVotes(row['Grand Total']),
                            ...partyVotes
                        };
                    }
                }

                resolve({
                    id: '2023',
                    type: 'election',
                    name: 'Local Elections 2023',
                    year: 2023,
                    wardResults: {},
                    wardData: {},
                    partyInfo: PARTY_INFO,
                    unmappedWards
                });
            },
            error: reject
        });
    });
};

const parseElection2022 = async (): Promise<Dataset> => {
    const res = await fetch('/data/elections/local-elections/local-elections-2022/Wards-results-Table 1.csv');
    const csvText = await res.text();
    const lines = csvText.split('\n');
    const dataStart = lines.findIndex(line => line.includes('Local authority name'));
    const cleanedCsv = lines.slice(dataStart).join('\n');

    return new Promise((resolve, reject) => {
        Papa.parse(cleanedCsv, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            complete: (results) => {
                const partyColumns = detectPartyColumns(results.meta.fields || []);
                const wardWinners: Record<string, string> = {};
                const allWardData: Record<string, WardData> = {};

                for (const row of results.data as any[]) {
                    const wardCode = row['Ward code']?.trim();
                    if (!wardCode) continue;

                    const partyVotes: Record<string, number> = {};

                    for (const party of partyColumns) {
                        partyVotes[party] = parseVotes(row[party]);
                    }

                    const winner = findWinner(partyVotes);

                    wardWinners[wardCode] = winner;
                    allWardData[wardCode] = {
                        wardName: row['Ward name'] || 'Unknown',
                        localAuthorityName: row['Local authority name'] || 'Unknown',
                        localAuthorityCode: row['Local authority code'] || 'Unknown',
                        turnoutPercent: parseTurnout(row['Turnout (%)']),
                        electorate: parseElectorate(row['Electorate']),
                        totalVotes: parseVotes(row['Total votes']),
                        ...partyVotes
                    };
                }

                resolve({
                    id: '2022',
                    type: 'election',
                    name: 'Local Elections 2022',
                    year: 2022,
                    wardResults: wardWinners,
                    wardData: allWardData,
                    partyInfo: PARTY_INFO
                });
            },
            error: reject
        });
    });
};

const parseElection2021 = async (): Promise<Dataset> => {
    const res = await fetch('/data/elections/local-elections/local_elections_2021_results-2/Wards-results-Table 1.csv');
    const csvText = await res.text();
    const lines = csvText.split('\n');
    const dataStart = lines.findIndex(line => line.includes('Local authority name'));
    const cleanedCsv = lines.slice(dataStart).join('\n');

    return new Promise((resolve, reject) => {
        Papa.parse(cleanedCsv, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            complete: (results) => {
                const partyColumns = detectPartyColumns(results.meta.fields || []);
                const wardWinners: Record<string, string> = {};
                const allWardData: Record<string, WardData> = {};

                for (const row of results.data as any[]) {
                    const wardCode = row['Ward/ED code']?.trim();
                    if (!wardCode) continue;

                    const partyVotes: Record<string, number> = {};

                    for (const party of partyColumns) {
                        partyVotes[party] = parseVotes(row[party]);
                    }

                    const winner = findWinner(partyVotes);

                    wardWinners[wardCode] = winner;
                    allWardData[wardCode] = {
                        wardName: row['Ward name'] || 'Unknown',
                        localAuthorityName: row['Local authority name'] || 'Unknown',
                        localAuthorityCode: row['Local authority code'] || 'Unknown',
                        turnoutPercent: parseTurnout(row['Turnout (%)']),
                        electorate: parseElectorate(row['Electorate']),
                        totalVotes: parseVotes(row['Total votes']),
                        ...partyVotes
                    };
                }

                resolve({
                    id: '2021',
                    type: 'election',
                    name: 'Local Elections 2021',
                    year: 2021,
                    wardResults: wardWinners,
                    wardData: allWardData,
                    partyInfo: PARTY_INFO
                });
            },
            error: reject
        });
    });
};

// Map 2023 data using ward codes from other datasets
const map2023WardCodes = (data2023: Dataset & { unmappedWards?: any }, referenceSets: Dataset[]): Dataset => {
    if (!data2023.unmappedWards) {
        return data2023;
    }

    // Build comprehensive ward lookup from all reference datasets
    const wardLookup = new Map<string, string>();

    for (const dataset of referenceSets) {
        if (dataset.wardData) {
            for (const [wardCode, data] of Object.entries(dataset.wardData)) {
                const name = data.wardName.toLowerCase().trim();
                const auth = data.localAuthorityName?.toLowerCase().trim() || '';
                const key = `${auth}|${name}`;

                // Only add if not already present (prioritize earlier years)
                if (!wardLookup.has(key)) {
                    wardLookup.set(key, wardCode);
                }
            }
        }
    }

    // Remap 2023 data
    const mappedWardResults: Record<string, string> = {};
    const mappedWardData: Record<string, WardData> = {};
    const unmappedWards: Record<string, any> = data2023.unmappedWards || {};

    // Process unmapped wards with the comprehensive lookup
    for (const wardInfo of Object.values(unmappedWards)) {
        const normalizedWard = wardInfo.wardName.toLowerCase().trim();
        const normalizedAuth = wardInfo.localAuthorityName?.toLowerCase().trim() || '';

        const wardCode = wardLookup.get(`${normalizedAuth}|${normalizedWard}`);

        if (wardCode) {
            mappedWardResults[wardCode] = wardInfo.winningParty;
            const { winningParty, ...restData } = wardInfo;
            mappedWardData[wardCode] = {
                ...restData,
                localAuthorityCode: wardCode.substring(0, 9)
            };
        }
    }

    // Merge with already mapped data
    const finalWardResults = { ...data2023.wardResults, ...mappedWardResults };
    const finalWardData = { ...data2023.wardData, ...mappedWardData };

    return {
        ...data2023,
        wardResults: finalWardResults,
        wardData: finalWardData,
        unmappedWards: undefined
    };
};

export const useElectionData = () => {
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const loadData = async () => {
            try {
                console.log('EXPENSIVE: Loading election data...');
                // Load all datasets in parallel for maximum performance
                const [data2024, data2023Raw, data2022, data2021] = await Promise.all([
                    parseElection2024().catch(err => {
                        console.error('2024 load failed:', err);
                        return null;
                    }),
                    parseCouncil2023().catch(err => {
                        console.error('2023 load failed:', err);
                        return null;
                    }),
                    parseElection2022().catch(err => {
                        console.error('2022 load failed:', err);
                        return null;
                    }),
                    parseElection2021().catch(err => {
                        console.error('2021 load failed:', err);
                        return null;
                    }),
                ]);

                // Build reference datasets for mapping (excluding 2023)
                const referenceSets = [data2024, data2022, data2021].filter(Boolean) as Dataset[];

                // Map 2023 using all available reference datasets
                const data2023 = data2023Raw ? map2023WardCodes(data2023Raw, referenceSets) : null;

                const loadedDatasets = [data2024, data2023, data2022, data2021].filter(Boolean) as Dataset[];

                console.log('Storing election datasets:', loadedDatasets);
                setDatasets(loadedDatasets);
                setLoading(false);
            } catch (err: any) {
                setError(err.message || 'Error loading election data');
                setLoading(false);
            }
        };

        loadData();
    }, []);

    return { datasets, loading, error };
};