// lib/hooks/useDatasetManager.ts
import { useMemo } from 'react';
import { BoundaryType } from './useBoundaryData';
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
            case "population":
            case "gender":
            case "density":
                return populationDatasets['population']
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

    const boundaryType: BoundaryType = activeDatasetId === 'general-2024' || activeDatasetId === 'general-2019' || activeDatasetId === 'general-2017' || activeDatasetId === 'general-2015' ? 'constituency' : 'ward';
    const targetYear = activeDatasetId === 'population' || activeDatasetId === 'gender' || activeDatasetId === 'density' ? 2021 : activeDataset?.year || null;

    return {
        activeDataset,
        boundaryType,
        targetYear,
    };
}