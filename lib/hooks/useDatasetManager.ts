// lib/hooks/useDatasetManager.ts
import { useMemo } from 'react';
import { BoundaryType } from './useBoundaryData';
import { GeneralElectionDataset } from './useGeneralElectionData';
import { Dataset } from '../types';

export const DATASET_IDS = {
    POPULATION: new Set(['population']),
    GENERAL_ELECTION: new Set(['general-2024']),
    LOCAL_ELECTION: new Set(['2024', '2023', '2022', '2021']),
} as const;

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
        if (DATASET_IDS.POPULATION.has(activeDatasetId)) return populationDatasets[activeDatasetId];
        if (DATASET_IDS.GENERAL_ELECTION.has(activeDatasetId)) return generalElectionDatasets[activeDatasetId];
        return localElectionDatasets[activeDatasetId];
    }, [localElectionDatasets, generalElectionDatasets, populationDatasets, activeDatasetId]);

    const boundaryType: BoundaryType =  DATASET_IDS.GENERAL_ELECTION.has(activeDatasetId) ? 'constituency' : 'ward';
    const targetYear: WardYear = DATASET_IDS.POPULATION.has(activeDatasetId) ? 2021 : activeDataset?.year || null;

    return {
        activeDataset,
        boundaryType,
        targetYear,
    };
}