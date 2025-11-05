// lib/hooks/useAggregatedElectionData.ts
import { RefObject, useMemo } from 'react';
import type { AggregatedLocalElectionData, AggregateGeneralElectionData, Dataset } from '@lib/types';
import { MapManager } from '../utils/mapManager';
import { GeneralElectionDataset } from './useGeneralElectionData';

interface UseAggregatedElectionDataParams {
	mapManagerRef: RefObject<MapManager | null>;
	geojson: any;
	selectedLocation: string | null;
	localElectionDatasets: Record<string, Dataset | null>;
	generalElectionDatasets: Record<string, GeneralElectionDataset | null>;
}

const LOCAL_ELECTION_IDS = ['2024', '2023', '2022', '2021'] as const;

/**
 * Aggregates both local and general election data for the current location.
 * Leverages MapManager's internal caching to avoid redundant calculations.
 */
export function useAggregatedElectionData({
	mapManagerRef,
	geojson,
	selectedLocation,
	localElectionDatasets,
	generalElectionDatasets,
}: UseAggregatedElectionDataParams) {
	/**
	 * Aggregated local election data - MapManager caches internally.
	 * Only recalculates when location or datasets change.
	 */
	const aggregatedLocalElectionData = useMemo((): AggregatedLocalElectionData => {
		if (!mapManagerRef.current || !geojson || !selectedLocation) {
			return { data2024: null, data2023: null, data2022: null, data2021: null };
		}

		const result: Partial<AggregatedLocalElectionData> = {};

		for (const year of LOCAL_ELECTION_IDS) {
			const dataset = localElectionDatasets[year];
			result[`data${year}` as keyof AggregatedLocalElectionData] = dataset?.wardData
				? mapManagerRef.current.calculateLocalElectionStats(selectedLocation, geojson, dataset.wardData, year)
				: null;
		}

		return result as AggregatedLocalElectionData;
	}, [mapManagerRef, geojson, localElectionDatasets, selectedLocation]);

	/**
	 * Aggregated general election data - fixed to pass constituencyData instead of constituencyResults.
	 * MapManager caches this calculation internally.
	 */
	const aggregatedGeneralElectionData = useMemo((): AggregateGeneralElectionData | null => {
		if (!mapManagerRef.current || !geojson || !selectedLocation) {
			return null;
		}

		const dataset = generalElectionDatasets['general-2024'];
		if (!dataset?.constituencyData) return null;

		// Pass constituencyData (not constituencyResults) - this was the bug
		const stats = mapManagerRef.current.calculateGeneralElectionStats(
			selectedLocation,
			geojson,
			dataset.constituencyData,
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