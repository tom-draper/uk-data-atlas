// lib/hooks/useAggregatedElectionData.ts
import { useMemo } from 'react';
import type { AggregatedLocalElectionData, AggregateGeneralElectionData, GeneralElectionDataset, LocalElectionDataset } from '@lib/types';
import { BoundaryData } from './useBoundaryData';
import { MapManager } from '../utils/mapManager';

interface UseAggregatedElectionDataParams {
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	localElectionDatasets: Record<string, LocalElectionDataset | null>;
	generalElectionDatasets: Record<string, GeneralElectionDataset | null>;
	location: string | null
}

/**
 * Aggregates both local and general election data for the current location.
 * Leverages MapManager's internal caching to avoid redundant calculations.
 */
export function useAggregatedElectionData({
	mapManager,
	boundaryData,
	localElectionDatasets,
	generalElectionDatasets,
	location
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
				result[year] = mapManager.calculateLocalElectionStats(geojson, dataset.wardData, location, year)
			} else {
				result[year] = null
			}
		}

		return result as AggregatedLocalElectionData;
	}, [mapManager, boundaryData, localElectionDatasets]);

	/**
	 * Aggregated general election data - fixed to pass constituencyData instead of constituencyResults.
	 * MapManager caches this calculation internally.
	 */
	const aggregatedGeneralElectionData = useMemo((): AggregateGeneralElectionData | null => {
		if (!mapManager || !boundaryData?.constituency) {
			return null;
		}

		const dataset = generalElectionDatasets['general-2024'];
		if (!dataset?.constituencyData) return null;

		const geojson = boundaryData.constituency[2024];
		if (!geojson) return null;

		// Pass constituencyData (not constituencyResults) - this was the bug
		const stats = mapManager.calculateGeneralElectionStats(
			geojson,
			dataset.constituencyData,
			'general-2024'
		);

		return {
			2024: {
				...stats,
				partyInfo: dataset.partyInfo || [],
			}
		};
	}, [mapManager, boundaryData.constituency, generalElectionDatasets]);

	return {
		aggregatedLocalElectionData,
		aggregatedGeneralElectionData,
	};
}
