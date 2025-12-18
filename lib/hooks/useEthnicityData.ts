// lib/hooks/useEthnicityData.ts
import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { EthnicityCategory, EthnicityDataset } from '../types';
import { withCDN } from '../helpers/cdn';

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

// Calculate the subcategory with the largest population for each LA
const calculateResults = (localAuthorityData: Record<string, Record<string, EthnicityCategory>>): Record<string, string> => {
    const results: Record<string, string> = {};

    for (const [localAuthorityCode, parentCategories] of Object.entries(localAuthorityData)) {
        let maxPopulation = 0;
        let majoritySubcategory = 'NONE';

        // Iterate through all parent categories and their subcategories
        for (const subcategories of Object.values(parentCategories)) {
            for (const [subcategoryName, data] of Object.entries(subcategories)) {
                if (data.population > maxPopulation) {
                    maxPopulation = data.population;
                    majoritySubcategory = subcategoryName;
                }
            }
        }

        results[localAuthorityCode] = majoritySubcategory;
    }

    return results;
};

const parseEthnicityData = async (): Promise<{
    data: Record<string, Record<string, EthnicityCategory>>;
    results: Record<string, string>;
}> => {
    const res = await fetch(withCDN('/data/ethnicity/TS021-2021-2.csv'));
    const csvText = await res.text();

    return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            complete: (results) => {
                const localAuthorityData: Record<string, Record<string, any>> = {};

                for (const row of results.data as any[]) {
                    const localAuthorityCode = row['Lower Tier Local Authorities Code']?.trim();
                    const ethnicGroupCode = row['Ethnic group (20 categories) Code']?.trim();

                    if (!localAuthorityCode || !ethnicGroupCode) continue;

                    // Skip "Does not apply" entries
                    if (ethnicGroupCode === '-8') continue;

                    // Initialize LA data if not exists
                    if (!localAuthorityData[localAuthorityCode]) {
                        localAuthorityData[localAuthorityCode] = {};
                    }

                    const fullName = row['Ethnic group (20 categories)']?.trim() || '';
                    const { parent, subcategory } = parseEthnicityName(fullName);
                    const observation = parseObservation(row['Observation']);

                    if (observation !== null) {
                        // Initialize parent category if not exists
                        if (!localAuthorityData[localAuthorityCode][parent]) {
                            localAuthorityData[localAuthorityCode][parent] = {};
                        }

                        // Store under parent category
                        localAuthorityData[localAuthorityCode][parent][subcategory] = {
                            ethnicity: subcategory,
                            population: observation,
                            code: ethnicGroupCode
                        };
                    }
                }

                // Calculate results (majority subcategory per LA)
                const ethnicityResults = calculateResults(localAuthorityData);

                console.log(`Loaded ethnicity data for ${Object.keys(localAuthorityData).length} local authorities`);
                console.log(`Calculated results for ${Object.keys(ethnicityResults).length} local authorities`);

                resolve({
                    data: localAuthorityData,
                    results: ethnicityResults
                });
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
                const { data, results } = await parseEthnicityData();

                const loadedDatasets: Record<string, EthnicityDataset> = {
                    2021: {
                        id: 'ethnicity2021',
                        type: 'ethnicity',
                        year: 2021,
                        boundaryType: 'localAuthority',
                        boundaryYear: 2025,
                        data,
                        results
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