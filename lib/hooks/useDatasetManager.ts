// lib/hooks/useDatasetManager.ts
import { useMemo } from 'react';
import { Dataset, GeneralElectionDataset } from '../types';

/**
 * Centralized dataset selection logic
 * Determines active dataset, mode, and boundary requirements
 */
export function useDatasetManager(
    activeDatasetId: string,
    localElectionDatasets: Record<string, Dataset | null>,
    generalElectionDatasets: Record<string, GeneralElectionDataset | null>,
    populationDatasets: Record<string, Dataset>
) {
    const activeDataset = useMemo(() => {
        switch (activeDatasetId) {
            case "age-distribution-2020":
            case "population-density-2020":
            case "gender-2020":
                return populationDatasets['population-2020']
            case "age-distribution-2021":
            case "population-density-2021":
            case "gender-2021":
                return populationDatasets['population-2021']
            case "age-distribution-2022":
            case "population-density-2022":
            case "gender-2022":
                return populationDatasets['population-2022']
            case "general-election-2024":
            case "general-election-2019":
            case "general-election-2017":
            case "general-election-2015":
                return generalElectionDatasets[activeDatasetId]
            case "local-election-2021":
            case "local-election-2022":
            case "local-election-2023":
            case "local-election-2024":
                return localElectionDatasets[activeDatasetId];
        }
    }, [localElectionDatasets, generalElectionDatasets, populationDatasets, activeDatasetId]);

    return activeDataset;
}