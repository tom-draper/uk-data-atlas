// lib/hooks/useElectionData.ts
import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { WardData } from '@lib//types';

export const useElectionData = () => {
    const [wardResults, setWardResults] = useState<Record<string, string>>({});
    const [wardData, setWardData] = useState<Record<string, WardData>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        fetch('/data/local-elections/LEH-2024-results-HoC-version/Wards results-Table 1.csv')
            .then(res => res.text())
            .then(csvText => {
                const lines = csvText.split('\n');
                const dataStart = lines.findIndex(line => line.includes('Local authority name'));
                const cleanedCsv = lines.slice(dataStart).join('\n');

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

                        setWardResults(wardWinners);
                        setWardData(allWardData);
                        setLoading(false);
                    },
                    error: (error: unknown) => {
                        setError(`CSV parse error: ${error}`);
                        setLoading(false);
                    }
                });
            })
            .catch(err => {
                setError(`Error loading election results: ${err.message}`);
                setLoading(false);
            });
    }, []);

    return { wardResults, wardData, loading, error };
};