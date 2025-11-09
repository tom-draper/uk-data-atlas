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

const GENERAL_ELECTION_YEARS = [2024, 2019, 2017, 2015] as const;

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
	 * Aggregated general election data - processes all available years.
	 * MapManager caches this calculation internally.
	 */
	const aggregatedGeneralElectionData = useMemo((): AggregateGeneralElectionData | null => {
		if (!mapManager || !boundaryData?.constituency) {
			return null;
		}

		const result: Partial<AggregateGeneralElectionData> = {};

		for (const year of GENERAL_ELECTION_YEARS) {
			const dataset = generalElectionDatasets[`general-${year}`];
			const geojson = boundaryData.constituency[year];

			if (dataset?.constituencyData && geojson) {
				// Pass constituencyData (not constituencyResults)
				const stats = mapManager.calculateGeneralElectionStats(
					geojson,
					dataset.constituencyData,
					`general-${year}`
				);

				result[year] = {
					...stats,
					partyInfo: dataset.partyInfo || [],
				};
			} else {
				result[year] = null;
			}
		}

		return result as AggregateGeneralElectionData;
	}, [mapManager, boundaryData.constituency, generalElectionDatasets]);

	return {
		aggregatedLocalElectionData,
		aggregatedGeneralElectionData,
	};
}