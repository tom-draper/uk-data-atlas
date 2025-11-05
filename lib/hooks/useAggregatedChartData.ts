// lib/hooks/useAggregatedElectionData.ts
import { RefObject, useMemo } from 'react';
import type { AggregatedLocalElectionData, AggregateGeneralElectionData, Dataset, GeneralElectionDataset, LocalElectionDataset } from '@lib/types';
import { MapManager } from '../utils/mapManager';
import { BoundaryData } from './useBoundaryData';

interface UseAggregatedElectionDataParams {
	mapManagerRef: RefObject<MapManager | null>;
	boundaryData: BoundaryData;
	selectedLocation: string | null;
	localElectionDatasets: Record<string, LocalElectionDataset | null>;
	generalElectionDatasets: Record<string, GeneralElectionDataset | null>;
}

/**
 * Aggregates both local and general election data for the current location.
 * Leverages MapManager's internal caching to avoid redundant calculations.
 */
export function useAggregatedElectionData({
	mapManagerRef,
	boundaryData,
	localElectionDatasets,
	generalElectionDatasets,
}: UseAggregatedElectionDataParams) {
	/**
	 * Aggregated local election data - MapManager caches internally.
	 * Only recalculates when location or datasets change.
	 */
	const aggregatedLocalElectionData = useMemo((): AggregatedLocalElectionData => {
		if (!mapManagerRef.current || !boundaryData) {
			return { 2024: null, 2023: null, 2022: null, 2021: null };
		}

		const result: Partial<AggregatedLocalElectionData> = {};

		for (const [year, geojson] of Object.entries(boundaryData.ward)) {
			const dataset = localElectionDatasets[year];
			result[year] = dataset?.wardData && geojson
				? mapManagerRef.current.calculateLocalElectionStats(geojson, dataset.wardData, year)
				: null;
		}

		return result as AggregatedLocalElectionData;
	}, [mapManagerRef, boundaryData, localElectionDatasets]);

	/**
	 * Aggregated general election data - fixed to pass constituencyData instead of constituencyResults.
	 * MapManager caches this calculation internally.
	 */
	const aggregatedGeneralElectionData = useMemo((): AggregateGeneralElectionData | null => {
		if (!mapManagerRef.current || !boundaryData) {
			return null;
		}

		const dataset = generalElectionDatasets['general-2024'];
		if (!dataset?.constituencyData) return null;

		const geojson = boundaryData.constituency[2024];
		if (!geojson) return null;

		// Pass constituencyData (not constituencyResults) - this was the bug
		const stats = mapManagerRef.current.calculateGeneralElectionStats(
			geojson,
			dataset.constituencyData,
			'general-2024'
		);

		return {
			...stats,
			partyInfo: dataset.partyInfo || {},
		};
	}, [mapManagerRef, boundaryData, generalElectionDatasets]);

	return {
		aggregatedLocalElectionData,
		aggregatedGeneralElectionData,
	};
}