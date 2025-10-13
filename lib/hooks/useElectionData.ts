// lib/hooks/useElectionData.ts
import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { WardData, Dataset } from '@/lib/types/index';

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
                    partyInfo: [
                        { key: 'LAB', name: 'Labour', color: '#DC241f' },
                        { key: 'CON', name: 'Conservative', color: '#0087DC' },
                        { key: 'LD', name: 'Liberal Democrat', color: '#FAA61A' },
                        { key: 'GREEN', name: 'Green', color: '#6AB023' },
                        { key: 'REF', name: 'Reform', color: '#12B6CF' },
                        { key: 'IND', name: 'Independent', color: '#CCCCCC' }
                    ]
                });
            },
            error: reject
        });
    });
};

const parseCouncil2023 = async (): Promise<Dataset> => {
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
                        partyInfo: [
                            { key: 'CON', name: 'Conservative', color: '#0087DC' },
                            { key: 'LAB', name: 'Labour', color: '#DC241f' },
                            { key: 'LD', name: 'Liberal Democrat', color: '#FAA61A' },
                            { key: 'GREEN', name: 'Green', color: '#6AB023' },
                            { key: 'REF', name: 'Reform', color: '#12B6CF' },
                            { key: 'IND', name: 'Independent', color: '#CCCCCC' }
                        ]
                    });
                    return;
                }

                // Create lookup map for matching ward names to IDs later
                const wardNameLookup: Record<string, string> = {};

                results.data.forEach((row: any) => {
                    if (!row || typeof row !== 'object') return;

                    const county = (row.COUNTYNAME || '').toString().trim();
                    const district = (row.DISTRICTNAME || '').toString().trim();
                    const ward = (row.WARDNAME || '').toString().trim();
                    
                    if (!ward) return;

                    // Store by ward name for later lookup
                    const nameKey = `${county}|${district}|${ward}`;
                    
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
                        wardNameLookup[nameKey] = nameKey; // placeholder, will be updated during mapping
                        allWardData[nameKey] = {
                            wardName: ward,
                            districtName: district,
                            countyName: county,
                            ...partyVotes
                        };
                    }
                });

                console.log('2023 parsed ward names:', Object.keys(allWardData).length);

                resolve({
                    id: '2023',
                    name: 'Local Elections 2023',
                    year: 2023,
                    wardResults: wardWinners,
                    wardData: allWardData,
                    partyColumns,
                    partyInfo: [
                        { key: 'CON', name: 'Conservative', color: '#0087DC' },
                        { key: 'LAB', name: 'Labour', color: '#DC241f' },
                        { key: 'LD', name: 'Liberal Democrat', color: '#FAA61A' },
                        { key: 'GREEN', name: 'Green', color: '#6AB023' },
                        { key: 'REF', name: 'Reform', color: '#12B6CF' },
                        { key: 'IND', name: 'Independent', color: '#CCCCCC' }
                    ],
                    wardNameLookup
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
                    partyInfo: [
                        { key: 'LAB', name: 'Labour', color: '#DC241f' },
                        { key: 'CON', name: 'Conservative', color: '#0087DC' },
                        { key: 'LD', name: 'Liberal Democrat', color: '#FAA61A' },
                        { key: 'GREEN', name: 'Green', color: '#6AB023' },
                        { key: 'REF', name: 'Reform', color: '#12B6CF' },
                        { key: 'IND', name: 'Independent', color: '#CCCCCC' }
                    ]
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
                    partyInfo: [
                        { key: 'LAB', name: 'Labour', color: '#DC241f' },
                        { key: 'CON', name: 'Conservative', color: '#0087DC' },
                        { key: 'LD', name: 'Liberal Democrat', color: '#FAA61A' },
                        { key: 'GREEN', name: 'Green', color: '#6AB023' },
                        { key: 'REF', name: 'Reform', color: '#12B6CF' },
                        { key: 'IND', name: 'Independent', color: '#CCCCCC' }
                    ]
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
                const [data2024, data2023, data2022, data2021] = await Promise.all([
                    parseElection2024(),
                    parseCouncil2023().catch(() => null),
                    parseElection2022(),
                    parseElection2021(),
                ]);
                
                const loadedDatasets = [data2024];
                if (data2023) loadedDatasets.push(data2023);
                if (data2022) loadedDatasets.push(data2022);
                if (data2021) loadedDatasets.push(data2021);

                console.log('Loaded datasets:', loadedDatasets);
                
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
