// lib/hooks/useHousePriceData.ts
import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { HousePriceDataset, WardHousePriceData } from '../types';
import { withCDN } from '../utils/cdn';

// Utility to parse price values
const parsePrice = (value: any): number | null => {
    if (!value || value === '') return null;
    const parsed = parseInt(String(value).replace(/,/g, '').trim());
    return isNaN(parsed) ? null : parsed;
};

const parseHousePriceData = async (): Promise<Record<string, WardHousePriceData>> => {
    const res = await fetch(withCDN('/data/economics/housing/HPSSA Dataset 37 - Median price paid by wardHPSSA Dataset 37 - Median price paid by ward.csv'));
    const csvText = await res.text();

    // Skip the first few rows that contain metadata
    const lines = csvText.split('\n');
    const dataStart = lines.findIndex(line => line.includes('Local authority code'));
    const cleanedCsv = lines.slice(dataStart).join('\n');

    return new Promise((resolve, reject) => {
        Papa.parse(cleanedCsv, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            complete: (results) => {
                const wardData: Record<string, WardHousePriceData> = {};

                // Get all time period headers (columns after the first 4)
                const headers = results.meta.fields || [];
                const timePeriodHeaders = headers.slice(4); // Skip: Local authority code, name, Ward code, name

                for (const row of results.data as any[]) {
                    const wardCode = row['Ward code']?.trim();
                    if (!wardCode) continue;

                    // Parse all years of price data
                    const prices: Record<number, number> = {};

                    timePeriodHeaders.forEach(period => {
                        const price = parsePrice(row[period]);
                        if (price !== null) {
                            // Extract year from period string (e.g., "Year ending Mar 2023" -> 2023)
                            const yearMatch = period.match(/\d{4}/);
                            if (yearMatch) {
                                const year = parseInt(yearMatch[0]);
                                prices[year] = price;
                            }
                        }
                    });

                    wardData[wardCode] = {
                        localAuthorityCode: row['Local authority code']?.trim() || '',
                        localAuthorityName: row['Local authority name']?.trim() || '',
                        wardCode,
                        wardName: row['Ward name']?.trim() || '',
                        prices
                    };
                }

                console.log(`Loaded house price data for ${Object.keys(wardData).length} wards`);
                resolve(wardData);
            },
            error: reject
        });
    });
};

export const useHousePriceData = () => {
    const [datasets, setDatasets] = useState<Record<string, HousePriceDataset>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const loadData = async () => {
            try {
                console.log('EXPENSIVE: Loading house price data...');
                const wardData = await parseHousePriceData();

                const loadedDatasets: Record<string, HousePriceDataset> = {
                    2023: {
                        id: 'housePrice2023',
                        type: 'housePrice',
                        year: 2023,
                        boundaryYear: 2021,
                        boundaryType: 'ward',
                        data: wardData
                    }
                };

                console.log('Storing house price datasets:', loadedDatasets);
                setDatasets(loadedDatasets);
                setLoading(false);
            } catch (err: any) {
                console.error('House price data load failed:', err);
                setError(err.message || 'Error loading house price data');
                setLoading(false);
            }
        };

        loadData();
    }, []);

    return { datasets, loading, error };
};