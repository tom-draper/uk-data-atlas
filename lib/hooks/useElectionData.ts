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
    const res = await fetch('/data/local-elections/LEH-2024-results-HoC-version/Wards results-Table 1.csv');
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

const parseCouncil2023 = async (data2024?: Dataset): Promise<Dataset> => {
    const res = await fetch('/data/local-elections/LEH-Candidates-2023/Ward_Level-Table 1.csv');
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
                        name: 'Council Elections 2023',
                        year: 2023,
                        wardResults: {},
                        wardData: {},
                        partyInfo: PARTY_INFO
                    });
                    return;
                }

                const partyColumns = detectPartyColumns(results.meta.fields || []);
                const wardWinners: Record<string, string> = {};
                const allWardData: Record<string, WardData> = {};

                // Build lookup map efficiently
                const wardLookup = new Map<string, string>();
                
                if (data2024?.wardData) {
                    for (const [wardCode, data] of Object.entries(data2024.wardData)) {
                        const name = data.wardName.toLowerCase().trim();
                        const auth = data.localAuthorityName?.toLowerCase().trim() || '';
                        wardLookup.set(`${auth}|${name}`, wardCode);
                    }
                }

                const tempWardData: Record<string, any> = {};

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
                        // Try to find matching ward code
                        const normalizedWard = ward.toLowerCase().trim();
                        const normalizedDistrict = district.toLowerCase().trim();
                        const normalizedCounty = county.toLowerCase().trim();
                        
                        let wardCode = wardLookup.get(`${normalizedDistrict}|${normalizedWard}`) 
                                    || wardLookup.get(`${normalizedCounty}|${normalizedWard}`);
                        
                        if (wardCode) {
                            wardWinners[wardCode] = winner;
                            allWardData[wardCode] = {
                                wardName: ward,
                                localAuthorityName: district || county || 'Unknown',
                                localAuthorityCode: wardCode.substring(0, 9),
                                districtName: district,
                                countyName: county,
                                turnoutPercent: parseTurnout(row['Turnout (%)']),
                                electorate: parseElectorate(row['Electorate']),
                                totalVotes: parseVotes(row['Total votes']),
                                ...partyVotes
                            };
                        } else {
                            // Store unmapped wards
                            const nameKey = `${county}|${district}|${ward}`;
                            tempWardData[nameKey] = {
                                wardName: ward,
                                localAuthorityName: district || county || 'Unknown',
                                districtName: district,
                                countyName: county,
                                winningParty: winner,
                                turnoutPercent: parseTurnout(row['Turnout (%)']),
                                electorate: parseElectorate(row['Electorate']),
                                totalVotes: parseVotes(row['Total votes']),
                                ...partyVotes
                            };
                        }
                    }
                }

                console.log('2023 mapped:', Object.keys(allWardData).length, 'unmapped:', Object.keys(tempWardData).length);

                resolve({
                    id: '2023',
                    name: 'Local Elections 2023',
                    year: 2023,
                    wardResults: wardWinners,
                    wardData: allWardData,
                    partyInfo: PARTY_INFO,
                    unmappedWards: tempWardData
                });
            },
            error: reject
        });
    });
};

const parseElection2022 = async (): Promise<Dataset> => {
    const res = await fetch('/data/local-elections/local-elections-2022/Wards-results-Table 1.csv');
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
    const res = await fetch('/data/local-elections/local_elections_2021_results-2/Wards-results-Table 1.csv');
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
                        ...partyVotes
                    };
                }

                resolve({
                    id: '2021',
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

export const useElectionData = () => {
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const loadData = async () => {
            try {
                // Load 2024 first for ward mapping
                const data2024 = await parseElection2024();
                
                // Load remaining datasets in parallel
                const [data2023, data2022, data2021] = await Promise.all([
                    parseCouncil2023(data2024).catch(err => {
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
                
                const loadedDatasets = [data2024, data2023, data2022, data2021].filter(Boolean) as Dataset[];
                
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
}