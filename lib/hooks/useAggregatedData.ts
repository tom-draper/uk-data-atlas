// lib/hooks/useAggregatedData.ts
import { useMemo } from 'react';
import type {
	Dataset,
	Datasets,
	BoundaryType,
	BoundaryGeojson,
	AggregatedData,
	BoundaryData,
} from '@lib/types';
import { MapManager } from '../helpers/mapManager';

interface DatasetConfig<T extends Dataset> {
	datasets: Record<string, T>;
	boundaryType: BoundaryType;
	calculateStats: (
		mapManager: MapManager,
		geojson: BoundaryGeojson,
		data: any,
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
) {
	if (!mapManager) return null;

	const result: Record<string, any> = {};

	for (const [datasetId, dataset] of Object.entries(config.datasets)) {
		// Get the appropriate boundary geojson
		const geojson = boundaryData[config.boundaryType]?.[dataset.boundaryYear];

		if (dataset.data && geojson) {
			result[dataset.year] = config.calculateStats(
				mapManager,
				geojson,
				dataset.data,
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
}: UseAggregatedDataParams): AggregatedData {
	// Define configuration for each dataset type
	const configs: Record<keyof Datasets, DatasetConfig<any>> = useMemo(() => ({
		localElection: {
			datasets: datasets.localElection,
			boundaryType: 'ward',
			calculateStats: (mm, geojson, data, loc, id) =>
				mm.calculateLocalElectionStats(geojson, data, loc, id),
		},
		generalElection: {
			datasets: datasets.generalElection,
			boundaryType: 'constituency',
			calculateStats: (mm, geojson, data, loc, id) =>
				mm.calculateGeneralElectionStats(geojson, data, loc, id),
		},
		population: {
			datasets: datasets.population,
			boundaryType: 'ward',
			calculateStats: (mm, geojson, data, loc, id) =>
				mm.calculatePopulationStats(geojson, data, loc, id),
		},
		ethnicity: {
			datasets: datasets.ethnicity,
			boundaryType: 'localAuthority',
			calculateStats: (mm, geojson, data, loc, id) =>
				mm.calculateEthnicityStats(geojson, data, loc, id),
		},
		housePrice: {
			datasets: datasets.housePrice,
			boundaryType: 'ward',
			calculateStats: (mm, geojson, data, loc, id) =>
				mm.calculateHousePriceStats(geojson, data, loc, id),
		},
		crime: {
			datasets: datasets.crime,
			boundaryType: 'localAuthority',
			calculateStats: (mm, geojson, data, loc, id) =>
				mm.calculateCrimeStats(geojson, data, loc, id),
		},
		income: {
			datasets: datasets.income,
			boundaryType: 'localAuthority',
			calculateStats: (mm, geojson, data, loc, id) =>
				mm.calculateIncomeStats(geojson, data, loc, id),
		},
	}), [datasets]);

	// Aggregate all datasets using the same logic
	const aggregatedData = useMemo(() => {
		if (!mapManager) {
			return {
				localElection: null,
				generalElection: null,
				population: null,
				ethnicity: null,
				housePrice: null,
				crime: null,
				income: null,
			};
		}

		return Object.fromEntries(
			Object.entries(configs).map(([key, config]) => [
				key,
				aggregateDataset(config, mapManager, boundaryData, location)
			])
		) as AggregatedData;
	}, [mapManager, boundaryData, location, configs]);

	return aggregatedData;
}