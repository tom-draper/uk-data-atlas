// lib/hooks/useAggregatedElectionData.ts
import { RefObject, useMemo } from 'react';
import type { AggregatedLocalElectionData, AggregateGeneralElectionData, Dataset } from '@lib/types';
import { MapManager } from '../utils/mapManager';
import { LOCATIONS } from '../data/locations';
import { GeneralElectionDataset } from './useGeneralElectionData';

interface UseAggregatedElectionDataParams {
	mapManagerRef: RefObject<MapManager | null>;
	geojson: any;
	selectedLocation: string | null;
	localElectionDatasets: Record<string, Dataset | null>;
	generalElectionDatasets: Record<string, GeneralElectionDataset | null>;
}

/**
 * Aggregates both local and general election data for the current location.
 * Both values are memoized and update automatically when dependencies change.
 */
export function useAggregatedElectionData({
	mapManagerRef,
	geojson,
	selectedLocation,
	localElectionDatasets,
	generalElectionDatasets,
}: UseAggregatedElectionDataParams) {
	const LOCAL_ELECTION_IDS = ['2024', '2023', '2022', '2021'] as const;

	/**
	 * Memoized aggregated local election data across all years.
	 * Calculates ward-level stats for each year in the current location.
	 */
	const aggregatedLocalElectionData = useMemo((): AggregatedLocalElectionData => {
		// Return empty data if dependencies not ready
		if (!mapManagerRef.current || !geojson || !selectedLocation) {
			return { data2024: null, data2023: null, data2022: null, data2021: null };
		}

		const result: Partial<AggregatedLocalElectionData> = {};
		
		for (const year of LOCAL_ELECTION_IDS) {
			const dataset = localElectionDatasets[year];
			result[`data${year}` as keyof AggregatedLocalElectionData] = dataset?.wardData
				? mapManagerRef.current.calculateLocalElectionLocationStats(selectedLocation, geojson, dataset.wardData, year)
				: null;
		}

		return result as AggregatedLocalElectionData;
	}, [mapManagerRef, geojson, localElectionDatasets, selectedLocation]);

	/**
	 * Memoized aggregated general election data for the current location.
	 * Only calculates when in general election mode.
	 */
	const aggregatedGeneralElectionData = useMemo((): AggregateGeneralElectionData | null => {
		// Early returns for missing dependencies or wrong mode
		if (!mapManagerRef.current || !geojson || !selectedLocation) {
			return null;
		}

		const dataset = generalElectionDatasets['general-2024'];
		if (!dataset) return null;

		// Calculate constituency stats using MapManager
		const stats = mapManagerRef.current.calculateConstituencyStats(
			selectedLocation,
			geojson,
			dataset.constituencyResults,
			'general-2024'
		);

		return {
			...stats,
			partyInfo: dataset.partyInfo || {},
		};
	}, [geojson, mapManagerRef, selectedLocation, generalElectionDatasets]);

	return {
		aggregatedLocalElectionData,
		aggregatedGeneralElectionData,
	};
}