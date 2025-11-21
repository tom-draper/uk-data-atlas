'use client';

import { useMemo } from 'react';

import { useLocalElectionData } from '@lib/hooks/useLocalElectionData';
import { useGeneralElectionData } from '@lib/hooks/useGeneralElectionData';
import { usePopulationData } from '@lib/hooks/usePopulationData';
import { useHousePriceData } from '@lib/hooks/useHousePriceData';
import { useCrimeData } from './useCrimeData';
import { Datasets } from '../types';

export interface UseDatasetsResult {
	datasets: Datasets;
	loading: boolean;
	errors: string[];
}

export function useDatasets(): UseDatasetsResult {
	// Load all dataset groups
	const localElection = useLocalElectionData();
	const generalElection = useGeneralElectionData();
	const population = usePopulationData();
	const housePrice = useHousePriceData();
	const crime = useCrimeData();

	// Combine datasets
	const datasets = useMemo(() => ({
		localElection: localElection.datasets,
		generalElection: generalElection.datasets,
		population: population.datasets,
		housePrice: housePrice.datasets,
		crime: crime.datasets,
	}), [localElection.datasets, generalElection.datasets, population.datasets, housePrice.datasets, crime.datasets]);

	// Combined loading state
	const loading = localElection.loading || generalElection.loading || population.loading || housePrice.loading;

	// Collect all errors
	const errors = useMemo(() => {
		const errs: string[] = [];
		if (localElection.error) errs.push(localElection.error);
		if (generalElection.error) errs.push(generalElection.error);
		if (population.error) errs.push(population.error);
		if (housePrice.error) errs.push(housePrice.error);
		if (crime.error) errs.push(crime.error);
		return errs;
	}, [
		localElection.error,
		generalElection.error,
		population.error,
		housePrice.error,
		crime.error,
	]);

	return { datasets, loading, errors };
}
