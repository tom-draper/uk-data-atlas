// lib/hooks/useAggregatedElectionData.ts
import { RefObject, useMemo } from 'react';
import type { AggregatedLocalElectionData, AggregateGeneralElectionData, GeneralElectionDataset, LocalElectionDataset } from '@lib/types';
import { BoundaryData } from './useBoundaryData';
import { MapManager } from '../utils/mapManager';

interface UseAggregatedElectionDataParams {
	mapManagerRef: RefObject<MapManager | null>;
	isManagerReady: boolean;
	boundaryData: BoundaryData;
	localElectionDatasets: Record<string, LocalElectionDataset | null>;
	generalElectionDatasets: Record<string, GeneralElectionDataset | null>;
}

/**
 * Aggregates both local and general election data for the current location.
 * Leverages MapManager's internal caching to avoid redundant calculations.
 */
export function useAggregatedElectionData({
	mapManagerRef,
	isManagerReady,
	boundaryData,
	localElectionDatasets,
	generalElectionDatasets,
}: UseAggregatedElectionDataParams) {
	/**
	 * Aggregated local election data - MapManager caches internally.
	 * Only recalculates when location or datasets change.
	 */
	const aggregatedLocalElectionData = useMemo((): AggregatedLocalElectionData => {
		if (!isManagerReady || !mapManagerRef.current || !boundaryData?.ward) {
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
	}, [isManagerReady, mapManagerRef, boundaryData.ward, localElectionDatasets]);

	/**
	 * Aggregated general election data - fixed to pass constituencyData instead of constituencyResults.
	 * MapManager caches this calculation internally.
	 */
	const aggregatedGeneralElectionData = useMemo((): AggregateGeneralElectionData | null => {
		if (!isManagerReady || !mapManagerRef.current || !boundaryData?.constituency) {
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
	}, [isManagerReady, mapManagerRef, boundaryData.constituency, generalElectionDatasets]);

	return {
		aggregatedLocalElectionData,
		aggregatedGeneralElectionData,
	};
}
