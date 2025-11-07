// lib/hooks/useDatasetManager.ts
import { useMemo } from 'react';
import { BoundaryType, WardYear } from './useBoundaryData';
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
                return generalElectionDatasets['general-2024']
            case "2021":
            case "2022":
            case "2023":
            case "2024":
                return localElectionDatasets[activeDatasetId];
        }
    }, [localElectionDatasets, generalElectionDatasets, populationDatasets, activeDatasetId]);

    const boundaryType: BoundaryType = activeDatasetId === 'general-2024' ? 'constituency' : 'ward';
    const targetYear: WardYear = activeDatasetId === 'population' || activeDatasetId === 'gender' || activeDatasetId === 'density' ? 2021 : activeDataset?.year || null;

    return {
        activeDataset,
        boundaryType,
        targetYear,
    };
}