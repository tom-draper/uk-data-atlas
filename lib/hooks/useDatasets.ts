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
import { Datasets } from "../types/datasets";
import { useEthnicityData } from "./useEthnicityData";
import { useBrexitData } from "./useBrexitData";
import { useBrexitConstituencyData } from "./useBrexitConstituencyData";
import { useIMDData } from "./useIMDData";
import { useSIMDData } from "./useSIMDData";
import { useWIMDData } from "./useWIMDData";
import { useNIMDMData } from "./useNIMDMData";
import { useLifeExpectancyData } from "./useLifeExpectancyData";
import { useQualificationData } from "./useQualificationData";
import { useJsonDatasetLoaders } from "./useJsonDataLoader";
import { SCALAR_DATASET_DEFINITIONS, type ScalarDatasetType } from "@/lib/datasets";
import { withCDN } from "@/lib/helpers/cdn";

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
	const scalarDatasets = useJsonDatasetLoaders(
		SCALAR_DATASET_DEFINITIONS.map((definition) => ({
			key: definition.type,
			url: withCDN(`/data/precompiled/${definition.precompiledFile}.json`),
			enabled: isEnabled(definition.chart.key),
		})),
	);
	const scalarDatasetRecords = Object.fromEntries(
		SCALAR_DATASET_DEFINITIONS.map((definition) => [
			definition.type,
			scalarDatasets.datasets[definition.type] ?? {},
		]),
	) as Pick<Datasets, ScalarDatasetType>;

	const datasets = {
		localElection: localElection.datasets,
		generalElection: generalElection.datasets,
		population: population.datasets,
		ethnicity: ethnicity.datasets,
		brexit: brexit.datasets,
		brexitConstituency: brexitConstituency.datasets,
		imd: imd.datasets,
		simd: simd.datasets,
		wimd: wimd.datasets,
		nimdm: nimdm.datasets,
		lifeExpectancy: lifeExpectancy.datasets,
		qualification: qualification.datasets,
		...scalarDatasetRecords,
	};

	const results = [
		localElection,
		generalElection,
		population,
		ethnicity,
		brexit,
		brexitConstituency,
		imd,
		simd,
		wimd,
		nimdm,
		lifeExpectancy,
		qualification,
		scalarDatasets,
	];

	const loading = results.some((r) => r.loading);
	const errors = results.flatMap((r) =>
		"errors" in r ? r.errors : r.error ? [r.error] : [],
	);

	return { datasets, loading, errors };
}
