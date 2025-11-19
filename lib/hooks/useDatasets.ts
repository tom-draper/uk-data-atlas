import { useMemo } from 'react';
import { useLocalElectionData } from './useLocalElectionData';
import { useGeneralElectionData } from './useGeneralElectionData';
import { usePopulationData } from './usePopulationData';
import { useHousePriceData } from './useHousePriceData';
import { useBoundaryData } from './useBoundaryData';
import { useAggregatedData } from './useAggregatedData';

interface UseAllDataParams {
	location: string;
	mapManager: any; // Pass this from MapInterface after map is initialized
}

export function useDatasets({ location, mapManager }: UseAllDataParams) {
	// Load all raw datasets
	const localElection = useLocalElectionData();
	const generalElection = useGeneralElectionData();
	const population = usePopulationData();
	const housePrice = useHousePriceData();

	const { boundaryData, isLoading: boundaryLoading } = useBoundaryData(location);

	// Combine all datasets
	const datasets = useMemo(() => ({
		'local-election': localElection.datasets,
		'general-election': generalElection.datasets,
		'population': population.datasets,
		'house-price': housePrice.datasets,
	}), [
		localElection.datasets,
		generalElection.datasets,
		population.datasets,
		housePrice.datasets,
	]);

	// Use your existing aggregation hook
	const {
		aggregatedLocalElectionData,
		aggregatedGeneralElectionData,
		aggregatedPopulationData,
		aggregatedHousePriceData,
	} = useAggregatedData({
		mapManager,
		boundaryData,
		localElectionDatasets: localElection.datasets,
		generalElectionDatasets: generalElection.datasets,
		populationDatasets: population.datasets,
		housePriceDatasets: housePrice.datasets,
		location,
	});

	// Combine aggregated data
	const aggregatedData = useMemo(() => ({
		'local-election': aggregatedLocalElectionData,
		'general-election': aggregatedGeneralElectionData,
		'population': aggregatedPopulationData,
		'house-price': aggregatedHousePriceData,
	}), [
		aggregatedLocalElectionData,
		aggregatedGeneralElectionData,
		aggregatedPopulationData,
		aggregatedHousePriceData,
	]);

	// Combine loading states
	const loading = 
		localElection.loading ||
		generalElection.loading ||
		population.loading ||
		housePrice.loading ||
		boundaryLoading;

	// Combine errors
	const errors = useMemo(() => {
		const errs: Record<string, string> = {};
		if (localElection.error) errs['local-election'] = localElection.error;
		if (generalElection.error) errs['general-election'] = generalElection.error;
		if (population.error) errs['population'] = population.error;
		if (housePrice.error) errs['house-price'] = housePrice.error;
		return errs;
	}, [localElection.error, generalElection.error, population.error, housePrice.error]);

	return { datasets, aggregatedData, boundaryData, loading, errors };
}