
// lib/hooks/useAggregatedData.ts
import { useMemo } from 'react';
import type {
	GeneralElectionDataset,
	LocalElectionDataset,
	PopulationDataset,
	HousePriceDataset,
	Dataset,
	Datasets,
	BoundaryType,
	BoundaryGeojson,
} from '@lib/types';
import { BoundaryData } from './useBoundaryData';
import { MapManager } from '../utils/mapManager';

interface DatasetConfig<T extends Dataset> {
	datasets: Record<string, T>;
	boundaryType: BoundaryType;
	getGeojson: (dataset: T, boundaryData: BoundaryData) => any;
	calculateStats: (
		mapManager: MapManager,
		geojson: BoundaryGeojson,
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
	datasets: Datasets;
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
			datasets: datasets.localElection,
			boundaryType: 'ward' as const,
			getGeojson: (dataset: LocalElectionDataset, bd: BoundaryData) => 
				bd.ward?.[dataset.boundaryYear],
			calculateStats: (mm: MapManager, geojson: BoundaryGeojson, dataset: LocalElectionDataset, loc: string | null, id: string) =>
				mm.calculateLocalElectionStats(geojson, dataset.wardData!, loc, id),
		},
		generalElection: {
			datasets: datasets.generalElection,
			boundaryType: 'constituency' as const,
			getGeojson: (dataset: GeneralElectionDataset, bd: BoundaryData) => 
				bd.constituency?.[dataset.boundaryYear],
			calculateStats: (mm: MapManager, geojson: BoundaryGeojson, dataset: GeneralElectionDataset, loc: string | null, id: string) =>
				mm.calculateGeneralElectionStats(geojson, dataset.constituencyData!, loc, id),
		},
		population: {
			datasets: datasets.population,
			boundaryType: 'ward' as const,
			getGeojson: (dataset: PopulationDataset, bd: BoundaryData) => 
				bd.ward?.[dataset.boundaryYear],
			calculateStats: (mm: MapManager, geojson: BoundaryGeojson, dataset: PopulationDataset, loc: string | null, id: string) =>
				mm.calculatePopulationStats(geojson, dataset.populationData!, loc, id),
		},
		housePrice: {
			datasets: datasets.housePrice,
			boundaryType: 'ward' as const,
			getGeojson: (dataset: HousePriceDataset, bd: BoundaryData) => 
				bd.ward?.[dataset.boundaryYear],
			calculateStats: (mm: MapManager, geojson: BoundaryGeojson, dataset: HousePriceDataset, loc: string | null, id: string) =>
				mm.calculateHousePriceStats(geojson, dataset.wardData!, loc, id),
		},
		// crime: {
		// 	datasets: datasets.housePrice,
		// 	boundaryType: 'ward' as const,
		// 	getGeojson: (dataset: HousePriceDataset, bd: BoundaryData) => 
		// 		bd.ward?.[dataset.boundaryYear],
		// 	calculateStats: (mm: MapManager, geojson: any, dataset: HousePriceDataset, loc: string | null, id: string) =>
		// 		mm.calculateHousePriceStats(geojson, dataset.wardData!, loc, id),
		// },
	}), [datasets]);

	// Aggregate all datasets using the same logic
	const aggregatedData = useMemo(() => {
		if (!mapManager) return {localElection: null, generalElection: null, population: null, housePrice: null};

		return {
			localElection: aggregateDataset(configs.localElection, mapManager, boundaryData, location),
			generalElection: aggregateDataset(configs.generalElection, mapManager, boundaryData, location),
			population: aggregateDataset(configs.population, mapManager, boundaryData, location),
			housePrice: aggregateDataset(configs.housePrice, mapManager, boundaryData, location),
		};
	}, [mapManager, boundaryData, location, configs]);

	return aggregatedData;
}