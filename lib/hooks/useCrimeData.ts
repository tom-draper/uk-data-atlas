// lib/hooks/useCrimeData.ts
import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { CrimeDataset, CrimeRecord } from '@lib/types';
import { withCDN } from '../utils/cdn';

const parseNumberStrict = (val: string): number => {
    if (!val || val.trim() === '') return 0;
    const cleaned = val.replace(/,/g, '').trim();
    const parsed = Number(cleaned);
    return isNaN(parsed) ? 0 : parsed;
};

const extractYearFromTitle = (title: string): number => {
    const match = title.match(/(\d{4})/);
    return match ? parseInt(match[1]) : new Date().getFullYear();
};

const skipMetadataRows = (rows: string[][]): string[][] => {
    let startIdx = 0;
    for (let i = 0; i < rows.length; i++) {
        if (rows[i][0]?.includes('Area Code') || rows[i][0]?.includes('area code')) {
            startIdx = i + 1;
            break;
        }
    }
    return rows.slice(startIdx);
};

export const useCrimeData = () => {
    const [datasets, setDatasets] = useState<Record<string, CrimeDataset>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const loadData = async () => {
            try {
                console.log('EXPENSIVE: Loading crime data...');

                const response = await fetch(withCDN('/data/crime/policeforceareatablesyejune25final.csv'));
                if (!response.ok) {
                    throw new Error(`Failed to fetch crime data: ${response.statusText}`);
                }

                const csvText = await response.text();

                Papa.parse(csvText, {
                    header: false,
                    skipEmptyLines: true,
                    complete: (results: any) => {
                        try {
                            const rows: string[][] = results.data;

                            // Extract metadata
                            const titleRow = rows[0]?.[0] || '';
                            // const sourceRow = rows.find(r => r[0]?.includes('Source:'))?.[0] || '';
                            const year = extractYearFromTitle(titleRow);

                            // Skip metadata rows and get data
                            const dataRows = skipMetadataRows(rows);

                            // Parse records
                            const records: Record<string, CrimeRecord> = {};

                            dataRows.forEach((row: string[]) => {
                                if (!row[0] || row[0].trim() === '') return;

                                const areaCode = row[0].trim();
                                const areaName = row[1]?.trim() || '';

                                if (areaCode === 'Area Code' || areaCode === 'area code') return;

                                const record: CrimeRecord = {
                                    areaCode,
                                    areaName,
                                    totalRecordedCrime: parseNumberStrict(row[2]),
                                    violenceAgainstPerson: parseNumberStrict(row[3]),
                                    homicide: parseNumberStrict(row[4]),
                                    deathSeriesInjuryUnlawfulDriving: parseNumberStrict(row[5]),
                                    violenceWithInjury: parseNumberStrict(row[6]),
                                    violenceWithoutInjury: parseNumberStrict(row[7]),
                                    stalkingHarassment: parseNumberStrict(row[8]),
                                    sexualOffences: parseNumberStrict(row[9]),
                                    robbery: parseNumberStrict(row[10]),
                                    theftOffences: parseNumberStrict(row[11]),
                                    burglary: parseNumberStrict(row[12]),
                                    residentialBurglary: parseNumberStrict(row[13]),
                                    nonResidentialBurglary: parseNumberStrict(row[14]),
                                    vehicleOffences: parseNumberStrict(row[15]),
                                    theftFromPerson: parseNumberStrict(row[16]),
                                    bicycleTheft: parseNumberStrict(row[17]),
                                    shoplifting: parseNumberStrict(row[18]),
                                    otherTheftOffences: parseNumberStrict(row[19]),
                                    criminalDamageArson: parseNumberStrict(row[20]),
                                    drugOffences: parseNumberStrict(row[21]),
                                    possessionWeapons: parseNumberStrict(row[22]),
                                    publicOrderOffences: parseNumberStrict(row[23]),
                                    miscellaneousCrimes: parseNumberStrict(row[24]),
                                };

                                records[areaCode] = record;
                            });

                            const dataset: CrimeDataset = {
                                id: `crime${year}`,
                                year,
                                type: 'crime',
                                boundaryType: 'localAuthority',
                                boundaryYear: year,
                                dataDate: `year ending June ${year}`,
                                jurisdiction: 'England and Wales',
                                records,
                                metadata: {
                                    source: 'Police recorded crime from the Home Office',
                                    notes: ['Police recorded crime statistics are published as official statistics, not accredited official statistics'],
                                },
                            };

                            console.log('Storing crime dataset for year', year);
                            setDatasets({ [year]: dataset });
                            setLoading(false);
                        } catch (parseErr: any) {
                            setError(parseErr.message || 'Error parsing crime data');
                            setLoading(false);
                        }
                    },
                    error: (parseError: any) => {
                        setError(`CSV parsing error: ${parseError.message}`);
                        setLoading(false);
                    },
                });
            } catch (err: any) {
                setError(err.message || 'Error loading crime data');
                setLoading(false);
            }
        };

        loadData();
    }, []);

    return { datasets, loading, error };
};