// lib/hooks/useAggregatedElectionData.ts
import { useMemo } from 'react';
import type {
	AggregatedLocalElectionData,
	AggregateGeneralElectionData,
	AggregatedPopulationData,
	AggregatedHousePriceData,
	GeneralElectionDataset,
	LocalElectionDataset,
	PopulationDataset,
	HousePriceDataset,
} from '@lib/types';
import { BoundaryData } from './useBoundaryData';
import { MapManager } from '../utils/mapManager';

interface UseAggregatedElectionDataParams {
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	localElectionDatasets: Record<string, LocalElectionDataset>;
	generalElectionDatasets: Record<string, GeneralElectionDataset>;
	populationDatasets: Record<string, PopulationDataset>;
	housePriceDatasets: Record<string, HousePriceDataset>;
	location: string | null;
}

/**
 * Aggregates local, general election, population, and house price data for the current location.
 * Leverages MapManager's internal caching to avoid redundant calculations.
 */
export function useAggregatedChartData({
	mapManager,
	boundaryData,
	localElectionDatasets,
	generalElectionDatasets,
	populationDatasets,
	housePriceDatasets,
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
			if (dataset.wardData && geojson) {
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
	}, [mapManager, boundaryData, localElectionDatasets, location]);

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
	}, [mapManager, boundaryData.constituency, generalElectionDatasets, location]);

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
			if (dataset.populationData && geojson) {
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
	}, [mapManager, boundaryData.ward, populationDatasets, location]);

	/**
	 * Aggregated house price data - MapManager caches internally.
	 * Only recalculates when location or datasets change.
	 */
	const aggregatedHousePriceData = useMemo((): AggregatedHousePriceData | null => {
		if (!mapManager || !boundaryData?.ward) {
			return null;
		}

		const result: Partial<AggregatedHousePriceData> = {};

		for (const [datasetId, dataset] of Object.entries(housePriceDatasets)) {
			// Use 2023 ward boundaries for house price data
			const geojson = boundaryData.ward[dataset.wardYear];
			if (dataset.wardData && geojson) {
				result[dataset.year] = mapManager.calculateHousePriceStats(
					geojson,
					dataset.wardData,
					location,
					datasetId
				);
			} else {
				result[dataset.year] = null;
			}
		}

		return result as AggregatedHousePriceData;
	}, [mapManager, boundaryData.ward, housePriceDatasets, location]);

	return {
		aggregatedLocalElectionData,
		aggregatedGeneralElectionData,
		aggregatedPopulationData,
		aggregatedHousePriceData,
	};
}