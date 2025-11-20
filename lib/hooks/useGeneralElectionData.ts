// lib/hooks/useGeneralElectionData.ts
import { useState, useEffect } from 'react';
import { GeneralElectionDataset } from '@lib/types';
import { fetchAndParseGeneralElectionData } from '../data/election/general-election/load';
import { GENERAL_ELECTION_SOURCES } from '../data/election/general-election/config';

export const useGeneralElectionData = () => {
    const [datasets, setDatasets] = useState<Record<string, GeneralElectionDataset>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const loadData = async () => {
            try {
                console.log('EXPENSIVE: Loading general election data...');

                const dataPromises = Object.values(GENERAL_ELECTION_SOURCES).map(config => 
                    fetchAndParseGeneralElectionData(config).catch(err => {
                        console.error(`Failed to load general election data for ${config.year}:`, err);
                        return null;
                    })
                );

                const results = await Promise.all(dataPromises);
                
                const loadedDatasets: Record<number, GeneralElectionDataset> = {};
                
                results.forEach(dataset => {
                    if (dataset) {
                        loadedDatasets[dataset.year] = dataset;
                    }
                });

                console.log('Storing general election datasets:', loadedDatasets);
                setDatasets(loadedDatasets);
                setLoading(false);
            } catch (err: any) {
                setError(err.message || 'Error loading general election data');
                setLoading(false);
            }
        };

        loadData();
    }, []);

    return { datasets, loading, error };
};