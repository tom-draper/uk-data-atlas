// lib/hooks/useIncomeData.ts
import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { withCDN } from '../utils/cdn';
import { AnnualIncomeData, HourlyIncomeData, IncomeDataset, LocalAuthorityIncomeData } from '../types/income';

// Utility to parse numeric values
const parseNumber = (value: any): number | null => {
    if (!value || value === '' || value === 'x' || value === '..' || value === ':' || value === '-') return null;
    const parsed = parseFloat(String(value).replace(/,/g, '').trim());
    return isNaN(parsed) ? null : parsed;
};

const parseAnnualIncomeData = async (): Promise<Record<string, AnnualIncomeData>> => {
    const res = await fetch(withCDN('/data/economics/income/PROV - Home Geography Table 8.7a   Annual pay - Gross 2025.csv'));
    const csvText = await res.text();

    const lines = csvText.split('\n');
    const dataStart = lines.findIndex(line => line.includes('Description') && line.includes('Code'));
    const cleanedCsv = lines.slice(dataStart).join('\n');

    return new Promise((resolve, reject) => {
        Papa.parse(cleanedCsv, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            complete: (results) => {
                const annualData: Record<string, AnnualIncomeData> = {};

                for (const row of results.data as any[]) {
                    const code = row['Code']?.trim();
                    const description = row['Description']?.trim();

                    if (!code || !description || code === 'Code' || !code.startsWith('E')) continue;

                    const median = parseNumber(row['Median']);
                    const mean = parseNumber(row['Mean']);

                    if (median === null && mean === null) continue;

                    annualData[code] = {
                        numberOfJobs: parseNumber(row['Number\nof jobsb\n(thousand)']),
                        median,
                        medianPercentageChange: parseNumber(row['Annual\npercentage\nchange']),
                        mean,
                        meanPercentageChange: parseNumber(row['Annual\npercentage\nchange.1']),
                        percentiles: {
                            p10: parseNumber(row['10']),
                            p20: parseNumber(row['20']),
                            p25: parseNumber(row['25']),
                            p30: parseNumber(row['30']),
                            p40: parseNumber(row['40']),
                            p60: parseNumber(row['60']),
                            p70: parseNumber(row['70']),
                            p75: parseNumber(row['75']),
                            p80: parseNumber(row['80']),
                            p90: parseNumber(row['90'])
                        }
                    };
                }

                console.log(`Loaded annual income data for ${Object.keys(annualData).length} local authorities`);
                resolve(annualData);
            },
            error: reject
        });
    });
};

const parseHourlyIncomeData = async (): Promise<Record<string, HourlyIncomeData>> => {
    const res = await fetch(withCDN('/data/income/PROV - Home Geography Table 8.5a   Hourly pay - Gross 2025.csv'));
    const csvText = await res.text();

    const lines = csvText.split('\n');
    const dataStart = lines.findIndex(line => line.includes('Description') && line.includes('Code'));
    const cleanedCsv = lines.slice(dataStart).join('\n');

    return new Promise((resolve, reject) => {
        Papa.parse(cleanedCsv, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            complete: (results) => {
                const hourlyData: Record<string, HourlyIncomeData> = {};

                for (const row of results.data as any[]) {
                    const code = row['Code']?.trim();
                    const description = row['Description']?.trim();

                    if (!code || !description || code === 'Code' || !code.startsWith('E')) continue;

                    const median = parseNumber(row['Median']);
                    const mean = parseNumber(row['Mean']);

                    if (median === null && mean === null) continue;

                    hourlyData[code] = {
                        numberOfJobs: parseNumber(row['Number\nof jobsb\n(thousand)']),
                        median,
                        medianPercentageChange: parseNumber(row['Annual\npercentage\nchange']),
                        mean,
                        meanPercentageChange: parseNumber(row['Annual\npercentage\nchange.1']),
                        percentiles: {
                            p10: parseNumber(row['10']),
                            p20: parseNumber(row['20']),
                            p25: parseNumber(row['25']),
                            p30: parseNumber(row['30']),
                            p40: parseNumber(row['40']),
                            p60: parseNumber(row['60']),
                            p70: parseNumber(row['70']),
                            p75: parseNumber(row['75']),
                            p80: parseNumber(row['80']),
                            p90: parseNumber(row['90'])
                        }
                    };
                }

                console.log(`Loaded hourly income data for ${Object.keys(hourlyData).length} local authorities`);
                resolve(hourlyData);
            },
            error: reject
        });
    });
};

const mergeIncomeData = (
    annualData: Record<string, AnnualIncomeData>,
    hourlyData: Record<string, HourlyIncomeData>
): Record<string, LocalAuthorityIncomeData> => {
    const merged: Record<string, LocalAuthorityIncomeData> = {};

    // Get all unique codes from both datasets
    const allCodes = new Set([...Object.keys(annualData), ...Object.keys(hourlyData)]);

    allCodes.forEach(code => {
        const annual = annualData[code];
        const hourly = hourlyData[code];

        // We need at least one dataset to have a name
        // Priority: use annual data name if available, otherwise hourly
        if (annual || hourly) {
            const name = annual ? (annualData[code]?.numberOfJobs !== null ?
                Object.keys(annualData).find(k => k === code) : '') :
                Object.keys(hourlyData).find(k => k === code);
            merged[code] = {
                code,
                name: name || '',
                annual: annual || null,
                hourly: hourly || null
            };
        }
    });

    return merged;
};

export const useIncomeData = () => {
    const [datasets, setDatasets] = useState<Record<string, IncomeDataset>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const loadData = async () => {
            try {
                console.log('EXPENSIVE: Loading income data...');

                const [annualData, hourlyData] = await Promise.all([
                    parseAnnualIncomeData(),
                    parseHourlyIncomeData()
                ]);

                const localAuthorityData = mergeIncomeData(annualData, hourlyData);

                const loadedDatasets: Record<string, IncomeDataset> = {
                    2025: {
                        id: 'income2025',
                        type: 'income',
                        year: 2025,
                        boundaryType: 'localAuthority',
                        boundaryYear: 2025,
                        localAuthorityData
                    }
                };

                console.log('Storing income datasets:', loadedDatasets);
                setDatasets(loadedDatasets);
                setLoading(false);
            } catch (err: any) {
                console.error('Income data load failed:', err);
                setError(err.message || 'Error loading income data');
                setLoading(false);
            }
        };

        loadData();
    }, []);

    return { datasets, loading, error };
}