"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_VISIBILITY, ChartKey } from "@/lib/context/ChartVisibilityContext";
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

const STORAGE_KEY = "uk-data-atlas-chart-visibility";

let _snap: Record<ChartKey, boolean> | null = null;
let _snapRaw: string | null | undefined = undefined;

function getVisibilitySnapshot(): Record<ChartKey, boolean> {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (raw === _snapRaw && _snap) return _snap;
	_snapRaw = raw;
	try {
		_snap = raw ? { ...DEFAULT_VISIBILITY, ...JSON.parse(raw) } : DEFAULT_VISIBILITY;
	} catch {
		_snap = DEFAULT_VISIBILITY;
	}
	return _snap!;
}

function getServerSnapshot(): Record<ChartKey, boolean> {
	return DEFAULT_VISIBILITY;
}

function subscribeVisibility(cb: () => void) {
	window.addEventListener("storage", cb);
	return () => window.removeEventListener("storage", cb);
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
		qualification.loading ||
		broadband.loading ||
		airQuality.loading;

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
	if (broadband.error) errors.push(broadband.error);
	if (airQuality.error) errors.push(airQuality.error);

	return { datasets, loading, errors };
}
