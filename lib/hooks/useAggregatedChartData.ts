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
	localElectionDatasets: Record<string, LocalElectionDataset | null>;
	generalElectionDatasets: Record<string, GeneralElectionDataset | null>;
	populationDatasets: Record<string, PopulationDataset | null>;
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

		for (const [year, geojson] of Object.entries(boundaryData.ward)) {
			const dataset = localElectionDatasets[year];
			if (dataset?.wardData && geojson) {
				result[year] = mapManager.calculateLocalElectionStats(
					geojson,
					dataset.wardData,
					location,
					year
				);
			} else {
				result[year] = null
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

		for (const [year, geojson] of Object.entries(boundaryData.constituency)) {
			const dataset = generalElectionDatasets[`general-${year}`];
			if (dataset?.constituencyData && geojson) {
				result[year] = mapManager.calculateGeneralElectionStats(
					geojson,
					dataset.constituencyData,
					location,
					`general-${year}`
				);
			} else {
				result[year] = null;
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

		// Only one 2020 population dataset that uses ward data from 2021 - but will be more in future
		for (const year of [2020]) {
			const dataset = populationDatasets[`population`];
			const geojson = boundaryData.ward[2021]; // 2020 population data uses 2021 ward boundaries

			if (dataset?.populationData && geojson) {
				result[year] = mapManager.calculatePopulationStats(
					geojson,
					dataset.populationData,
					location,
					`population`
				);
			} else {
				result[year] = null;
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