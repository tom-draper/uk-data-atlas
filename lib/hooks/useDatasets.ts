"use client";

import { useMemo } from "react";

import { useLocalElectionData } from "@lib/hooks/useLocalElectionData";
import { useGeneralElectionData } from "@lib/hooks/useGeneralElectionData";
import { usePopulationData } from "@lib/hooks/usePopulationData";
import { useHousePriceData } from "@lib/hooks/useHousePriceData";
import { useCrimeData } from "./useCrimeData";
import { Datasets } from "../types";
import { useIncomeData } from "./useIncomeData";
import { useEthnicityData } from "./useEthnicityData";
import { useBrexitData } from "./useBrexitData";
import { useBrexitConstituencyData } from "./useBrexitConstituencyData";
import { useIMDData } from "./useIMDData";
import { useLifeExpectancyData } from "./useLifeExpectancyData";

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
	const brexit = useBrexitData();
	const brexitConstituency = useBrexitConstituencyData();
	const imd = useIMDData();
	const lifeExpectancy = useLifeExpectancyData();

	// Combine datasets
	const datasets = useMemo(
		() => ({
			localElection: localElection.datasets,
			generalElection: generalElection.datasets,
			population: population.datasets,
			ethnicity: ethnicity.datasets,
			housePrice: housePrice.datasets,
			crime: crime.datasets,
			income: income.datasets,
			brexit: brexit.datasets,
			brexitConstituency: brexitConstituency.datasets,
			imd: imd.datasets,
			lifeExpectancy: lifeExpectancy.datasets,
		}),
		[
			localElection.datasets,
			generalElection.datasets,
			population.datasets,
			ethnicity.datasets,
			housePrice.datasets,
			crime.datasets,
			income.datasets,
			brexit.datasets,
			brexitConstituency.datasets,
			imd.datasets,
			lifeExpectancy.datasets,
		],
	);

	// Combined loading state
	const loading =
		localElection.loading ||
		generalElection.loading ||
		population.loading ||
		ethnicity.loading ||
		housePrice.loading ||
		crime.loading ||
		income.loading ||
		brexit.loading ||
		brexitConstituency.loading ||
		imd.loading ||
		lifeExpectancy.loading;

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
		if (brexit.error) errs.push(brexit.error);
		if (brexitConstituency.error) errs.push(brexitConstituency.error);
		if (imd.error) errs.push(imd.error);
		if (lifeExpectancy.error) errs.push(lifeExpectancy.error);
		return errs;
	}, [
		localElection.error,
		generalElection.error,
		population.error,
		ethnicity.error,
		housePrice.error,
		crime.error,
		income.error,
		brexit.error,
		brexitConstituency.error,
		imd.error,
		lifeExpectancy.error,
	]);

	return { datasets, loading, errors };
}
