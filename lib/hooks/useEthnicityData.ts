// lib/hooks/useEthnicityData.ts
import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { EthnicityCategory, EthnicityDataset } from '../types';
import { withCDN } from '../utils/cdn';

// Utility to parse observation values
const parseObservation = (value: any): number | null => {
    if (!value || value === '') return null;
    const parsed = parseInt(String(value).replace(/,/g, '').trim());
    return isNaN(parsed) ? null : parsed;
};

// Extract parent category and subcategory from full ethnicity name
const parseEthnicityName = (fullName: string): { parent: string; subcategory: string } => {
    // Handle names like "Asian, Asian British or Asian Welsh: Bangladeshi"
    const colonIndex = fullName.indexOf(':');
    
    if (colonIndex !== -1) {
        return {
            parent: fullName.substring(0, colonIndex).trim(),
            subcategory: fullName.substring(colonIndex + 1).trim()
        };
    }
    
    // If no colon, treat entire name as parent category
    return {
        parent: fullName.trim(),
        subcategory: fullName.trim()
    };
};

const parseEthnicityData = async (): Promise<Record<string, Record<string, EthnicityCategory>>> => {
    const res = await fetch(withCDN('/data/ethnicity/TS021-2021-2.csv'));
    const csvText = await res.text();

    return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            complete: (results) => {
                const laData: Record<string, Record<string, any>> = {};

                for (const row of results.data as any[]) {
                    const laCode = row['Lower Tier Local Authorities Code']?.trim();
                    const ethnicGroupCode = row['Ethnic group (20 categories) Code']?.trim();

                    if (!laCode || !ethnicGroupCode) continue;

                    // Skip "Does not apply" entries
                    if (ethnicGroupCode === '-8') continue;

                    // Initialize LA data if not exists
                    if (!laData[laCode]) {
                        laData[laCode] = {};
                    }

                    const fullName = row['Ethnic group (20 categories)']?.trim() || '';
                    const { parent, subcategory } = parseEthnicityName(fullName);
                    const observation = parseObservation(row['Observation']);

                    if (observation !== null) {
                        // Initialize parent category if not exists
                        if (!laData[laCode][parent]) {
                            laData[laCode][parent] = {};
                        }

                        // Store under parent category
                        laData[laCode][parent][subcategory] = {
                            ethnicity: subcategory,
                            population: observation,
                            code: ethnicGroupCode
                        };
                    }
                }

                console.log(`Loaded ethnicity data for ${Object.keys(laData).length} local authorities`);
                resolve(laData);
            },
            error: reject
        });
    });
};

export const useEthnicityData = () => {
    const [datasets, setDatasets] = useState<Record<string, EthnicityDataset>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const loadData = async () => {
            try {
                console.log('EXPENSIVE: Loading ethnicity data...');
                const laData = await parseEthnicityData();

                const loadedDatasets: Record<string, EthnicityDataset> = {
                    2021: {
                        id: 'ethnicity2021',
                        type: 'ethnicity',
                        year: 2021,
                        boundaryType: 'localAuthority',
                        boundaryYear: 2022,
                        localAuthorityData: laData
                    }
                };

                console.log('Storing ethnicity datasets:', loadedDatasets);
                setDatasets(loadedDatasets);
                setLoading(false);
            } catch (err: any) {
                console.error('Ethnicity data load failed:', err);
                setError(err.message || 'Error loading ethnicity data');
                setLoading(false);
            }
        };

        loadData();
    }, []);

    return { datasets, loading, error };
};