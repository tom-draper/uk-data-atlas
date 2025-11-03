// lib/hooks/useAggregatedElectionData.ts
import { RefObject, useMemo } from 'react';
import type { AggregatedLocalElectionData, AggregateGeneralElectionData } from '@lib/types';
import { MapManager } from '../utils/mapManager';
import { LOCATIONS } from '../data/locations';

interface UseAggregatedElectionDataParams {
	mapManagerRef: RefObject<MapManager | null>;
	geojson: any;
	localElectionDatasets: any[];
	generalElectionDatasets: any[];
	selectedLocation: string | null;
	isGeneralElectionMode: boolean;
}

/**
 * Aggregates both local and general election data for the current location.
 * Both values are memoized and update automatically when dependencies change.
 */
export function useAggregatedElectionData({
	mapManagerRef,
	geojson,
	localElectionDatasets,
	generalElectionDatasets,
	selectedLocation,
	isGeneralElectionMode,
}: UseAggregatedElectionDataParams) {
	const YEARS = ['2024', '2023', '2022', '2021'] as const;

	/**
	 * Memoized aggregated local election data across all years.
	 * Calculates ward-level stats for each year in the current location.
	 */
	const aggregatedLocalElectionData = useMemo((): AggregatedLocalElectionData => {
		// Return empty data if dependencies not ready
		if (!mapManagerRef.current || !geojson || !selectedLocation) {
			return { data2024: null, data2023: null, data2022: null, data2021: null };
		}

		const location = LOCATIONS.find(loc => loc.name === selectedLocation);
		if (!location) {
			return { data2024: null, data2023: null, data2022: null, data2021: null };
		}

		const result: Partial<AggregatedLocalElectionData> = {};
		
		for (const year of YEARS) {
			const dataset = localElectionDatasets.find(d => d.id === year);
			result[`data${year}` as keyof AggregatedLocalElectionData] = dataset?.wardData
				? mapManagerRef.current.calculateLocationStats(location, geojson, dataset.wardData, year)
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
		if (!isGeneralElectionMode || !geojson || !mapManagerRef.current || !selectedLocation) {
			return null;
		}

		const location = LOCATIONS.find(loc => loc.name === selectedLocation);
		if (!location) return null;

		const dataset = generalElectionDatasets.find(d => d.id === 'general-2024');
		if (!dataset) return null;

		// Calculate constituency stats using MapManager
		const stats = mapManagerRef.current.calculateConstituencyStats(
			location,
			geojson,
			dataset.constituencyResults,
			'general-2024'
		);

		return {
			...stats,
			partyInfo: dataset.partyInfo || {},
		};
	}, [isGeneralElectionMode, geojson, mapManagerRef, selectedLocation, generalElectionDatasets]);

	return {
		aggregatedLocalElectionData,
		aggregatedGeneralElectionData,
	};
}