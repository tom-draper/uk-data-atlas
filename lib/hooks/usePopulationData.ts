// lib/hooks/usePopulationData.ts
'use client';
import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { PopulationData } from '@/lib/types';

export const usePopulationData = () => {
    const [populationDatasets, setPopulationDatasets] = useState<{
        females: PopulationData;
        males: PopulationData;
        persons: PopulationData;
    }>({
        females: {},
        males: {},
        persons: {},
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const loadPopulationData = async () => {
            try {
                const [femalesResponse, malesResponse, personsResponse] = await Promise.all([
                    fetch('/data/age/Mid-2020 Females-Table 1.csv'),
                    fetch('/data/age/Mid-2020 Males-Table 1.csv'),
                    fetch('/data/age/Mid-2020 Persons-Table 1.csv'),
                ]);

                const [femalesText, malesText, personsText] = await Promise.all([
                    femalesResponse.text(),
                    malesResponse.text(),
                    personsResponse.text(),
                ]);

                const parsePopulationData = (csvText: string): PopulationData => {
                    const data: PopulationData = {};
                    
                    Papa.parse(csvText, {
                        skipEmptyLines: true,
                        complete: (results) => {
                            let wardCodeIndex = -1;
                            let allAgesIndex = -1;

                            results.data.forEach((row: any, index: number) => {
                                // Find indices from header row (row 4, index 4)
                                if (index === 4) {
                                    wardCodeIndex = row.findIndex((col: any) => col?.trim?.()?.includes('Ward Code'));
                                    allAgesIndex = row.findIndex((col: any) => col?.trim?.() === 'All Ages');
                                    return;
                                }

                                // Skip rows before header
                                if (index <= 4) {
                                    return;
                                }

                                if (!Array.isArray(row) || row.length < Math.max(wardCodeIndex, allAgesIndex) + 1) {
                                    return;
                                }

                                const wardCode = row[wardCodeIndex]?.trim();
                                const allAgesStr = row[allAgesIndex]?.trim();

                                if (wardCode && wardCode.startsWith('E05') && allAgesStr) {
                                    // Remove commas and parse the total population
                                    const totalPopulation = parseInt(
                                        allAgesStr.replace(/,/g, ''),
                                        10
                                    );

                                    if (!isNaN(totalPopulation)) {
                                        data[wardCode] = {
                                            TOTAL: totalPopulation,
                                        };
                                    }
                                }
                            });
                        },
                        error: (error) => {
                            throw new Error(`CSV parsing error: ${error.message}`);
                        },
                    });
                    
                    return data;
                };

                const femalesData = parsePopulationData(femalesText);
                const malesData = parsePopulationData(malesText);
                const personsData = parsePopulationData(personsText);

                setPopulationDatasets({
                    females: femalesData,
                    males: malesData,
                    persons: personsData,
                });

                setLoading(false);
            } catch (err) {
                console.error('Population data loading error:', err);
                setError(err instanceof Error ? err.message : 'Failed to load population data');
                setLoading(false);
            }
        };

        loadPopulationData();
    }, []);

    return { populationDatasets, loading, error };
};