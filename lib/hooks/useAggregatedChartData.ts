// lib/hooks/useAggregatedElectionData.ts
import { useMemo } from 'react';
import type {
	AggregatedLocalElectionData,
	AggregateGeneralElectionData,
	GeneralElectionDataset,
	LocalElectionDataset,
	PopulationDataset,
	AggregatedPopulationData,
} from '@lib/types';
import { BoundaryData } from './useBoundaryData';
import { MapManager } from '../utils/mapManager';

interface UseAggregatedElectionDataParams {
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	localElectionDatasets: Record<string, LocalElectionDataset>;
	generalElectionDatasets: Record<string, GeneralElectionDataset>;
	populationDatasets: Record<string, PopulationDataset>;
	location: string | null;
}

/**
 * Aggregates local, general election, and population data for the current location.
 * Leverages MapManager's internal caching to avoid redundant calculations.
 */
export function useAggregatedElectionData({
	mapManager,
	boundaryData,
	localElectionDatasets,
	generalElectionDatasets,
	populationDatasets,
	location,
}: UseAggregatedElectionDataParams) {
	/**
	 * Aggregated local election data - MapManager caches internally.
	 * Only recalculates when location or datasets change.
	 */
	const aggregatedLocalElectionData = useMemo((): AggregatedLocalElectionData | null => {
		if (!mapManager || !boundaryData?.ward) {
			return null;
		}

		const result: Partial<AggregatedLocalElectionData> = {};

		for (const [datasetId, dataset] of Object.entries(localElectionDatasets)) {
			const geojson = boundaryData.ward[dataset.wardYear];
			if (dataset?.wardData && geojson) {
				result[dataset.year] = mapManager.calculateLocalElectionStats(
					geojson,
					dataset.wardData,
					location,
					datasetId
				);
			} else {
				result[dataset.year] = null
			}
		}

		return result as AggregatedLocalElectionData;
	}, [mapManager, boundaryData, localElectionDatasets]);

	/**
	 * Aggregated general election data - processes all available years.
	 * MapManager caches this calculation internally.
	 */
	const aggregatedGeneralElectionData = useMemo((): AggregateGeneralElectionData | null => {
		if (!mapManager || !boundaryData?.constituency) {
			return null;
		}

		const result: Partial<AggregateGeneralElectionData> = {};

		for (const [datasetId, dataset] of Object.entries(generalElectionDatasets)) {
			const geojson = boundaryData.constituency[dataset.constituencyYear];
			if (dataset?.constituencyData && geojson) {
				result[dataset.year] = mapManager.calculateGeneralElectionStats(
					geojson,
					dataset.constituencyData,
					location,
					datasetId
				);
			} else {
				result[dataset.year] = null;
			}
		}

		return result as AggregateGeneralElectionData;
	}, [mapManager, boundaryData.constituency, generalElectionDatasets]);

	/**
	 * Aggregated population data - calculates stats and age data.
	 * MapManager caches this calculation internally.
	 */
	const aggregatedPopulationData = useMemo((): AggregatedPopulationData | null => {
		if (!mapManager || !boundaryData?.ward) {
			return null;
		}

		const result: Partial<AggregatedPopulationData> = {};

		for (const [datasetId, dataset] of Object.entries(populationDatasets)) {
			const geojson = boundaryData.ward[dataset.wardYear]; 
			if (dataset?.populationData && geojson) {
				result[dataset.year] = mapManager.calculatePopulationStats(
					geojson,
					dataset.populationData,
					location,
					datasetId
				);
			} else {
				result[dataset.year] = null;
			}

		}

		return result as AggregatedPopulationData;
	}, [mapManager, boundaryData.ward, populationDatasets]);

	return {
		aggregatedLocalElectionData,
		aggregatedGeneralElectionData,
		aggregatedPopulationData,
	};
}