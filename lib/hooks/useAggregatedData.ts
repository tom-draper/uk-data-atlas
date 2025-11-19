
// lib/hooks/useAggregatedData.ts
import { useMemo } from 'react';
import type {
	GeneralElectionDataset,
	LocalElectionDataset,
	PopulationDataset,
	HousePriceDataset,
	Dataset,
} from '@lib/types';
import { BoundaryData } from './useBoundaryData';
import { MapManager } from '../utils/mapManager';

interface DatasetConfig<T extends Dataset> {
	datasets: Record<string, T>;
	boundaryType: 'ward' | 'constituency';
	getGeojson: (dataset: T, boundaryData: BoundaryData) => any;
	calculateStats: (
		mapManager: MapManager,
		geojson: any,
		dataset: T,
		location: string | null,
		datasetId: string
	) => any;
}

/**
 * Generic aggregation function - works for ANY dataset type
 */
function aggregateDataset<T extends Dataset>(
	config: DatasetConfig<T>,
	mapManager: MapManager | null,
	boundaryData: BoundaryData,
	location: string | null
): Record<string, any> | null {
	if (!mapManager) return null;

	const result: Record<string, any> = {};

	for (const [datasetId, dataset] of Object.entries(config.datasets)) {
		const geojson = config.getGeojson(dataset, boundaryData);
		const hasData = 
			(dataset as any).wardData || 
			(dataset as any).constituencyData || 
			(dataset as any).populationData;

		if (hasData && geojson) {
			result[dataset.year] = config.calculateStats(
				mapManager,
				geojson,
				dataset,
				location,
				datasetId
			);
		} else {
			result[dataset.year] = null;
		}
	}

	return result;
}

interface UseAggregatedDataParams {
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	datasets: {
		'local-election': Record<string, LocalElectionDataset>;
		'general-election': Record<string, GeneralElectionDataset>;
		'population': Record<string, PopulationDataset>;
		'house-price': Record<string, HousePriceDataset>;
	};
	location: string | null;
}

/**
 * Unified hook that aggregates ALL dataset types
 */
export function useAggregatedData({
	mapManager,
	boundaryData,
	datasets,
	location,
}: UseAggregatedDataParams) {
	// Define configuration for each dataset type
	const configs = useMemo(() => ({
		localElection: {
			datasets: datasets['local-election'],
			boundaryType: 'ward' as const,
			getGeojson: (dataset: LocalElectionDataset, bd: BoundaryData) => 
				bd.ward?.[dataset.wardYear],
			calculateStats: (mm: MapManager, geojson: any, dataset: LocalElectionDataset, loc: string | null, id: string) =>
				mm.calculateLocalElectionStats(geojson, dataset.wardData!, loc, id),
		},
		generalElection: {
			datasets: datasets['general-election'],
			boundaryType: 'constituency' as const,
			getGeojson: (dataset: GeneralElectionDataset, bd: BoundaryData) => 
				bd.constituency?.[dataset.constituencyYear],
			calculateStats: (mm: MapManager, geojson: any, dataset: GeneralElectionDataset, loc: string | null, id: string) =>
				mm.calculateGeneralElectionStats(geojson, dataset.constituencyData!, loc, id),
		},
		population: {
			datasets: datasets['population'],
			boundaryType: 'ward' as const,
			getGeojson: (dataset: PopulationDataset, bd: BoundaryData) => 
				bd.ward?.[dataset.wardYear],
			calculateStats: (mm: MapManager, geojson: any, dataset: PopulationDataset, loc: string | null, id: string) =>
				mm.calculatePopulationStats(geojson, dataset.populationData!, loc, id),
		},
		housePrice: {
			datasets: datasets['house-price'],
			boundaryType: 'ward' as const,
			getGeojson: (dataset: HousePriceDataset, bd: BoundaryData) => 
				bd.ward?.[dataset.wardYear],
			calculateStats: (mm: MapManager, geojson: any, dataset: HousePriceDataset, loc: string | null, id: string) =>
				mm.calculateHousePriceStats(geojson, dataset.wardData!, loc, id),
		},
	}), [datasets['local-election'], datasets['general-election'], datasets['population'], datasets['house-price']]);

	// Aggregate all datasets using the same logic
	const aggregatedData = useMemo(() => {
		if (!mapManager) return {'local-election': null, 'general-election': null, 'population': null, 'house-price': null};

		return {
			'local-election': aggregateDataset(configs.localElection, mapManager, boundaryData, location),
			'general-election': aggregateDataset(configs.generalElection, mapManager, boundaryData, location),
			'population': aggregateDataset(configs.population, mapManager, boundaryData, location),
			'house-price': aggregateDataset(configs.housePrice, mapManager, boundaryData, location),
		};
	}, [mapManager, boundaryData, location, configs]);

	return aggregatedData;
}