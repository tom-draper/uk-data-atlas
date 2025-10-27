// lib/hooks/useElectionData.ts
import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { WardData, Dataset } from '@lib/types/index';
import { PARTY_INFO } from '../data/parties';

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
            complete: (results) => {
                const wardWinners: Record<string, string> = {};
                const allWardData: Record<string, WardData> = {};
                const partyColumns = ['LAB', 'CON', 'LD', 'GREEN', 'REF', 'IND'];

                results.data.forEach((row: any) => {
                    const wardCode = row['Ward code']?.trim();
                    if (!wardCode) return;

                    let maxVotes = 0;
                    let winningParty = 'OTHER';
                    const partyVotes: Record<string, number> = {};

                    partyColumns.forEach(party => {
                        const votes = parseInt(row[party]?.replace(/,/g, '') || '0');
                        partyVotes[party] = votes;
                        if (votes > maxVotes) {
                            maxVotes = votes;
                            winningParty = party;
                        }
                    });

                    wardWinners[wardCode] = winningParty;
                    allWardData[wardCode] = {
                        wardName: row['Ward name'] || 'Unknown',
                        localAuthorityName: row['Local authority name'] || 'Unknown',
                        localAuthorityCode: row['Local authority code'] || 'Unknown',
                        ...partyVotes
                    };
                });

                resolve({
                    id: '2024',
                    name: 'Local Elections 2024',
                    year: 2024,
                    wardResults: wardWinners,
                    wardData: allWardData,
                    partyColumns,
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
            delimiter: ',',
            complete: (results) => {
                const wardWinners: Record<string, string> = {};
                const allWardData: Record<string, WardData> = {};
                const partyColumns = ['CON', 'LAB', 'LD', 'GREEN', 'REF', 'IND'];

                if (!results.data || results.data.length === 0) {
                    console.warn('2023: No data rows found');
                    resolve({
                        id: '2023',
                        name: 'Council Elections 2023',
                        year: 2023,
                        wardResults: {},
                        wardData: {},
                        partyColumns,
                        partyInfo: PARTY_INFO
                    });
                    return;
                }

                // Create lookup map for matching ward names to IDs from 2024 data
                const wardName2024Lookup: Record<string, string> = {};
                
                if (data2024?.wardData) {
                    Object.entries(data2024.wardData).forEach(([wardCode, data]) => {
                        const normalizedName = data.wardName.toLowerCase().trim();
                        const normalizedAuth = data.localAuthorityName?.toLowerCase().trim() || '';
                        const key = `${normalizedAuth}|${normalizedName}`;
                        wardName2024Lookup[key] = wardCode;
                    });
                }

                const tempWardData: Record<string, any> = {};

                results.data.forEach((row: any) => {
                    if (!row || typeof row !== 'object') return;

                    const county = (row.COUNTYNAME || '').toString().trim();
                    const district = (row.DISTRICTNAME || '').toString().trim();
                    const ward = (row.WARDNAME || '').toString().trim();
                    
                    if (!ward) return;
                    
                    let maxVotes = 0;
                    let winningParty = 'OTHER';
                    const partyVotes: Record<string, number> = {};

                    partyColumns.forEach(party => {
                        let votes = 0;
                        const cellValue = row[party];
                        
                        if (cellValue && cellValue !== '') {
                            const parsed = parseInt(cellValue.toString().replace(/,/g, '').trim());
                            votes = isNaN(parsed) ? 0 : parsed;
                        }
                        
                        partyVotes[party] = votes;
                        if (votes > maxVotes) {
                            maxVotes = votes;
                            winningParty = party;
                        }
                    });

                    if (maxVotes > 0) {
                        // Try to find matching ward code from 2024 data
                        const normalizedWard = ward.toLowerCase().trim();
                        const normalizedDistrict = district.toLowerCase().trim();
                        
                        // Try matching with district name first
                        let lookupKey = `${normalizedDistrict}|${normalizedWard}`;
                        let wardCode = wardName2024Lookup[lookupKey];
                        
                        if (!wardCode) {
                            // Try with county name
                            const normalizedCounty = county.toLowerCase().trim();
                            lookupKey = `${normalizedCounty}|${normalizedWard}`;
                            wardCode = wardName2024Lookup[lookupKey];
                        }
                        
                        if (wardCode) {
                            // Successfully mapped to a ward code
                            wardWinners[wardCode] = winningParty;
                            allWardData[wardCode] = {
                                wardName: ward || 'Unknown',
                                localAuthorityName: district || county || 'Unknown',
                                localAuthorityCode: wardCode.substring(0, 9) || 'Unknown', // Extract LA code from ward code
                                districtName: district || '',
                                countyName: county || '',
                                ...partyVotes
                            };
                        } else {
                            // Store with original name key if no match found
                            const nameKey = `${county}|${district}|${ward}`;
                            tempWardData[nameKey] = {
                                wardName: ward || 'Unknown',
                                localAuthorityName: district || county || 'Unknown',
                                districtName: district || '',
                                countyName: county || '',
                                winningParty,
                                ...partyVotes
                            };
                        }
                    }
                });

                console.log('2023 mapped to ward codes:', Object.keys(allWardData).length);
                console.log('2023 unmapped wards:', Object.keys(tempWardData).length);

                resolve({
                    id: '2023',
                    name: 'Local Elections 2023',
                    year: 2023,
                    wardResults: wardWinners,
                    wardData: allWardData,
                    partyColumns,
                    partyInfo: PARTY_INFO,
                    unmappedWards: tempWardData
                });
            },
            error: (err) => {
                console.error('2023 CSV parse error:', err);
                reject(err);
            }
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
            complete: (results) => {
                const wardWinners: Record<string, string> = {};
                const allWardData: Record<string, WardData> = {};
                const partyColumns = ['LAB', 'CON', 'LD', 'GREEN', 'REF', 'IND'];

                results.data.forEach((row: any) => {
                    const wardCode = row['Ward code']?.trim();
                    if (!wardCode) return;

                    let maxVotes = 0;
                    let winningParty = 'OTHER';
                    const partyVotes: Record<string, number> = {};

                    partyColumns.forEach(party => {
                        const votes = parseInt(row[party]?.replace(/,/g, '') || '0');
                        partyVotes[party] = votes;
                        if (votes > maxVotes) {
                            maxVotes = votes;
                            winningParty = party;
                        }
                    });

                    wardWinners[wardCode] = winningParty;
                    allWardData[wardCode] = {
                        wardName: row['Ward name'] || 'Unknown',
                        localAuthorityName: row['Local authority name'] || 'Unknown',
                        localAuthorityCode: row['Local authority code'] || 'Unknown',
                        ...partyVotes
                    };
                });

                resolve({
                    id: '2022',
                    name: 'Local Elections 2022',
                    year: 2022,
                    wardResults: wardWinners,
                    wardData: allWardData,
                    partyColumns,
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
            complete: (results) => {
                const wardWinners: Record<string, string> = {};
                const allWardData: Record<string, WardData> = {};
                const partyColumns = ['LAB', 'CON', 'LD', 'GREEN', 'REF', 'IND'];

                results.data.forEach((row: any) => {
                    const wardCode = row['Ward/ED code']?.trim();
                    if (!wardCode) return;

                    let maxVotes = 0;
                    let winningParty = 'OTHER';
                    const partyVotes: Record<string, number> = {};

                    partyColumns.forEach(party => {
                        const votes = parseInt(row[party]?.replace(/,/g, '') || '0');
                        partyVotes[party] = votes;
                        if (votes > maxVotes) {
                            maxVotes = votes;
                            winningParty = party;
                        }
                    });

                    wardWinners[wardCode] = winningParty;
                    allWardData[wardCode] = {
                        wardName: row['Ward name'] || 'Unknown',
                        localAuthorityName: row['Local authority name'] || 'Unknown',
                        localAuthorityCode: row['Local authority code'] || 'Unknown',
                        ...partyVotes
                    };
                });

                resolve({
                    id: '2021',
                    name: 'Local Elections 2021',
                    year: 2021,
                    wardResults: wardWinners,
                    wardData: allWardData,
                    partyColumns,
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
            console.log('Loading election data')
            try {
                // Load 2024 data first to use for mapping 2023 ward names
                const data2024 = await parseElection2024();
                
                const [data2023, data2022, data2021] = await Promise.all([
                    parseCouncil2023(data2024).catch(() => null),
                    parseElection2022(),
                    parseElection2021(),
                ]);
                
                const loadedDatasets = [data2024];
                if (data2023) loadedDatasets.push(data2023);
                if (data2022) loadedDatasets.push(data2022);
                if (data2021) loadedDatasets.push(data2021);

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
}