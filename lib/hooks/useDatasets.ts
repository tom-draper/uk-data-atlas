'use client';

import { useMemo } from 'react';

import { useLocalElectionData } from '@lib/hooks/useLocalElectionData';
import { useGeneralElectionData } from '@lib/hooks/useGeneralElectionData';
import { usePopulationData } from '@lib/hooks/usePopulationData';
import { useHousePriceData } from '@lib/hooks/useHousePriceData';
import { useCrimeData } from './useCrimeData';
import { Datasets } from '../types';
import { useIncomeData } from './useIncomeData';
import { useEthnicityData } from './useEthnicityData';

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
	const ethnicity = useEthnicityData();
	const housePrice = useHousePriceData();
	const crime = useCrimeData();
	const income = useIncomeData();

	// Combine datasets
	const datasets = useMemo(() => ({
		localElection: localElection.datasets,
		generalElection: generalElection.datasets,
		population: population.datasets,
		ethnicity: ethnicity.datasets,
		housePrice: housePrice.datasets,
		crime: crime.datasets,
		income: income.datasets,
	}), [
		localElection.datasets,
		generalElection.datasets,
		population.datasets,
		ethnicity.datasets,
		housePrice.datasets,
		crime.datasets,
		income.datasets
	]);

	// Combined loading state
	const loading = (
		localElection.loading ||
		generalElection.loading ||
		population.loading ||
		ethnicity.loading ||
		housePrice.loading ||
		crime.loading ||
		income.loading
	);

	// Collect all errors
	const errors = useMemo(() => {
		const errs: string[] = [];
		if (localElection.error) errs.push(localElection.error);
		if (generalElection.error) errs.push(generalElection.error);
		if (population.error) errs.push(population.error);
		if (ethnicity.error) errs.push(ethnicity.error);
		if (housePrice.error) errs.push(housePrice.error);
		if (crime.error) errs.push(crime.error);
		if (income.error) errs.push(income.error);
		return errs;
	}, [
		localElection.error,
		generalElection.error,
		population.error,
		ethnicity.error,
		housePrice.error,
		crime.error,
		income.error,
	]);

	return { datasets, loading, errors };
}
