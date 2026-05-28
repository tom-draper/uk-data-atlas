"use client";

import {
	DEFAULT_VISIBILITY,
	ChartKey,
} from "@/lib/context/ChartVisibilityContext";

const STORAGE_KEY = "uk-data-atlas-chart-visibility";

function isEnabled(key: ChartKey): boolean {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored) as Partial<
				Record<ChartKey, boolean>
			>;
			if (key in parsed) return parsed[key]!;
		}
	} catch {
		// ignore
	}
	return DEFAULT_VISIBILITY[key];
}

import { useLocalElectionData } from "@lib/hooks/useLocalElectionData";
import { useGeneralElectionData } from "@lib/hooks/useGeneralElectionData";
import { usePopulationData } from "@lib/hooks/usePopulationData";
import { useHousePriceData } from "@lib/hooks/useHousePriceData";
import { useCrimeData } from "./useCrimeData";
import { Datasets } from "../types/datasets";
import { useIncomeData } from "./useIncomeData";
import { useEthnicityData } from "./useEthnicityData";
import { useBrexitData } from "./useBrexitData";
import { useBrexitConstituencyData } from "./useBrexitConstituencyData";
import { useIMDData } from "./useIMDData";
import { useSIMDData } from "./useSIMDData";
import { useWIMDData } from "./useWIMDData";
import { useNIMDMData } from "./useNIMDMData";
import { useLifeExpectancyData } from "./useLifeExpectancyData";
import { useQualificationData } from "./useQualificationData";

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
	const brexitConstituency = useBrexitConstituencyData(
		isEnabled("brexit-hanretty"),
	);
	const imd = useIMDData();
	const simd = useSIMDData();
	const wimd = useWIMDData();
	const nimdm = useNIMDMData();
	const lifeExpectancy = useLifeExpectancyData(
		isEnabled("society-healthyLifeExpectancy"),
	);
	const qualification = useQualificationData();

	const datasets = {
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
		simd: simd.datasets,
		wimd: wimd.datasets,
		nimdm: nimdm.datasets,
		lifeExpectancy: lifeExpectancy.datasets,
		qualification: qualification.datasets,
	};

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
		simd.loading ||
		wimd.loading ||
		nimdm.loading ||
		lifeExpectancy.loading ||
		qualification.loading;

	// Collect all errors
	const errors: string[] = [];
	if (localElection.error) errors.push(localElection.error);
	if (generalElection.error) errors.push(generalElection.error);
	if (population.error) errors.push(population.error);
	if (ethnicity.error) errors.push(ethnicity.error);
	if (housePrice.error) errors.push(housePrice.error);
	if (crime.error) errors.push(crime.error);
	if (income.error) errors.push(income.error);
	if (brexit.error) errors.push(brexit.error);
	if (brexitConstituency.error) errors.push(brexitConstituency.error);
	if (imd.error) errors.push(imd.error);
	if (simd.error) errors.push(simd.error);
	if (wimd.error) errors.push(wimd.error);
	if (nimdm.error) errors.push(nimdm.error);
	if (lifeExpectancy.error) errors.push(lifeExpectancy.error);
	if (qualification.error) errors.push(qualification.error);

	return { datasets, loading, errors };
}
