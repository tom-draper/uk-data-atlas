"use client";

import { useSyncExternalStore } from "react";
import {
	DEFAULT_VISIBILITY,
	ChartKey,
	getVisibilitySnapshot,
	subscribeVisibility,
} from "@/lib/context/ChartVisibilityContext";
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
import { useBroadbandData } from "./useBroadbandData";
import { useAirQualityData } from "./useAirQualityData";
import { useClaimantCountData } from "./useClaimantCountData";
import { useSchoolPerformanceData } from "./useSchoolPerformanceData";
import { useNHSWaitingData } from "./useNHSWaitingData";
import { useUnemploymentData } from "./useUnemploymentData";
import { useChildPovertyData } from "./useChildPovertyData";
import { useHomelessnessData } from "./useHomelessnessData";

function getServerSnapshot(): Record<ChartKey, boolean> {
	return DEFAULT_VISIBILITY;
}

export interface UseDatasetsResult {
	datasets: Datasets;
	loading: boolean;
	errors: string[];
}

export function useDatasets(): UseDatasetsResult {
	const visibility = useSyncExternalStore(subscribeVisibility, getVisibilitySnapshot, getServerSnapshot);
	const isEnabled = (key: ChartKey) => visibility[key] ?? DEFAULT_VISIBILITY[key];
	const anyEnabled = (...keys: ChartKey[]) => keys.some(k => isEnabled(k));

	const localElection = useLocalElectionData(
		anyEnabled("localElection-2021", "localElection-2022", "localElection-2023", "localElection-2024", "localElection-2025"),
	);
	const generalElection = useGeneralElectionData(
		anyEnabled("generalElection-2015", "generalElection-2017", "generalElection-2019", "generalElection-2024"),
	);
	const population = usePopulationData();
	const ethnicity = useEthnicityData(isEnabled("demographics-ethnicity"));
	const housePrice = useHousePriceData(isEnabled("economics-housePrice"));
	const crime = useCrimeData(isEnabled("economics-crime"));
	const income = useIncomeData(isEnabled("economics-income"));
	const brexit = useBrexitData(isEnabled("brexit-electoral"));
	const brexitConstituency = useBrexitConstituencyData(isEnabled("brexit-hanretty"));
	const imd = useIMDData(isEnabled("deprivation-imd"));
	const simd = useSIMDData(isEnabled("deprivation-simd"));
	const wimd = useWIMDData(isEnabled("deprivation-wimd"));
	const nimdm = useNIMDMData(isEnabled("deprivation-nimdm"));
	const lifeExpectancy = useLifeExpectancyData(
		anyEnabled("health-lifeExpectancy", "health-healthyLifeExpectancy"),
		isEnabled("health-healthyLifeExpectancy"),
	);
	const qualification = useQualificationData(isEnabled("education-qualifications"));
	const broadband = useBroadbandData(isEnabled("telecoms-broadband"));
	const airQuality = useAirQualityData(isEnabled("environment-airQuality"));
	const claimantCount = useClaimantCountData(isEnabled("economics-claimantCount"));
	const schoolPerformance = useSchoolPerformanceData(isEnabled("education-schoolPerformance"));
	const nhsWaiting = useNHSWaitingData(isEnabled("health-nhsWaiting"));
	const unemployment = useUnemploymentData(isEnabled("economics-unemployment"));
	const childPoverty = useChildPovertyData(isEnabled("economics-childPoverty"));
	const homelessness = useHomelessnessData(isEnabled("economics-homelessness"));

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
		broadband: broadband.datasets,
		airQuality: airQuality.datasets,
		claimantCount: claimantCount.datasets,
		schoolPerformance: schoolPerformance.datasets,
		nhsWaiting: nhsWaiting.datasets,
		unemployment: unemployment.datasets,
		childPoverty: childPoverty.datasets,
		homelessness: homelessness.datasets,
	};

	const results = [
		localElection,
		generalElection,
		population,
		ethnicity,
		housePrice,
		crime,
		income,
		brexit,
		brexitConstituency,
		imd,
		simd,
		wimd,
		nimdm,
		lifeExpectancy,
		qualification,
		broadband,
		airQuality,
		claimantCount,
		schoolPerformance,
		nhsWaiting,
		unemployment,
		childPoverty,
		homelessness,
	];

	const loading = results.some((r) => r.loading);
	const errors = results.flatMap((r) => (r.error ? [r.error] : []));

	return { datasets, loading, errors };
}
