// lib/hooks/useGeneralElectionData.ts
import { useState, useEffect } from 'react';
import { GeneralElectionDataset } from '@lib/types';
import { fetchAndParseGeneralElectionData } from '../data/election/general-election/load';
import { GENERAL_ELECTION_SOURCES } from '../data/election/general-election/config';

const DATA_CACHE: Record<string, GeneralElectionDataset> = {};

export const useGeneralElectionData = () => {
    const [datasets, setDatasets] = useState<Record<string, GeneralElectionDataset>>(DATA_CACHE);
    const [loading, setLoading] = useState(Object.keys(DATA_CACHE).length === 0);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        // If data is already in the cache, skip fetching
        if (Object.keys(DATA_CACHE).length > 0) {
            setLoading(false);
            return;
        }

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
                
                const loadedDatasets: Record<string, GeneralElectionDataset> = {};
                
                results.forEach(dataset => {
                    if (dataset) {
                        loadedDatasets[dataset.id] = dataset;
                    }
                });

                // Mutate the global cache and update local state
                Object.assign(DATA_CACHE, loadedDatasets);

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