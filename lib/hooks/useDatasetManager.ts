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
            case "population-2020":
            case "gender-2020":
            case "density-2020":
                return populationDatasets['population-2020']
            case "population-2021":
            case "gender-2021":
            case "density-2021":
                return populationDatasets['population-2021']
            case "population-2022":
            case "gender-2022":
            case "density-2022":
                return populationDatasets['population-2022']
            case "general-2024":
            case "general-2019":
            case "general-2017":
            case "general-2015":
                return generalElectionDatasets[activeDatasetId]
            case "2021":
            case "2022":
            case "2023":
            case "2024":
                return localElectionDatasets[activeDatasetId];
        }
    }, [localElectionDatasets, generalElectionDatasets, populationDatasets, activeDatasetId]);

    return activeDataset;
}