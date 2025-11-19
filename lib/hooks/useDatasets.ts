'use client';

import { useMemo } from 'react';

import { useLocalElectionData } from '@lib/hooks/useLocalElectionData';
import { useGeneralElectionData } from '@lib/hooks/useGeneralElectionData';
import { usePopulationData } from '@lib/hooks/usePopulationData';
import { useHousePriceData } from '@lib/hooks/useHousePriceData';

export interface UseDatasetsResult {
	datasets: {
		'local-election': any;
		'general-election': any;
		'population': any;
		'house-price': any;
	};
	loading: boolean;
	errors: string[];
}

export function useDatasets(): UseDatasetsResult {
	// Load all dataset groups
	const localElection = useLocalElectionData();
	const generalElection = useGeneralElectionData();
	const population = usePopulationData();
	const housePrice = useHousePriceData();

	// Combine datasets
	const datasets = useMemo(
		() => ({
			'local-election': localElection.datasets,
			'general-election': generalElection.datasets,
			population: population.datasets,
			'house-price': housePrice.datasets,
		}),
		[
			localElection.datasets,
			generalElection.datasets,
			population.datasets,
			housePrice.datasets,
		]
	);

	// Combined loading state
	const loading = localElection.loading || generalElection.loading || population.loading || housePrice.loading;

	// Collect all errors
	const errors = useMemo(() => {
		const errs: string[] = [];
		if (localElection.error) errs.push(localElection.error);
		if (generalElection.error) errs.push(generalElection.error);
		if (population.error) errs.push(population.error);
		if (housePrice.error) errs.push(housePrice.error);
		return errs;
	}, [
		localElection.error,
		generalElection.error,
		population.error,
		housePrice.error,
	]);

	return { datasets, loading, errors };
}
