"use client";

import { useSyncExternalStore } from "react";
import {
	DEFAULT_VISIBILITY,
	ChartKey,
	getVisibilitySnapshot,
	subscribeVisibility,
} from "@/lib/context/ChartVisibilityContext";
import { Datasets } from "../types/datasets";
import { useJsonDatasetLoaders } from "./useJsonDataLoader";
import {
	CHART_DATASET_DEFINITIONS,
	type ChartDatasetType,
} from "@/lib/datasets";
import { getChartDefinitions } from "@/lib/datasets/types";
import { withCDN } from "@/lib/helpers/cdn";
import {
	REGION_CHUNKED_DATASET_TYPES,
	regionChunkPath,
	regionChunksForLocation,
} from "@/lib/data/datasetRegionChunks";

function getServerSnapshot(): Record<ChartKey, boolean> {
	return DEFAULT_VISIBILITY;
}

export interface UseDatasetsResult {
	datasets: Datasets;
	loading: boolean;
	errors: string[];
}

export function useDatasets(selectedLocation: string): UseDatasetsResult {
	const visibility = useSyncExternalStore(
		subscribeVisibility,
		getVisibilitySnapshot,
		getServerSnapshot,
	);
	const isEnabled = (key: ChartKey) =>
		visibility[key] ?? DEFAULT_VISIBILITY[key];

	const chartDatasets = useJsonDatasetLoaders(
		CHART_DATASET_DEFINITIONS.map((definition) => ({
			key: definition.type,
			url: withCDN(
				`/data/precompiled/${definition.precompiledFile}.json`,
			),
			filter: {
				location: selectedLocation,
				boundaryType: definition.boundaryType,
				includeLocationPopulationSummary:
					definition.type === "population",
			},
			chunkUrls: REGION_CHUNKED_DATASET_TYPES.has(definition.type)
				? (regionChunksForLocation(selectedLocation)?.map((region) =>
						withCDN(
							regionChunkPath(definition.precompiledFile, region),
						),
					) ?? undefined)
				: undefined,
			enabled: getChartDefinitions(definition).some((chart) =>
				isEnabled(chart.key),
			),
		})),
	);
	const chartDatasetRecords = Object.fromEntries(
		CHART_DATASET_DEFINITIONS.map((definition) => [
			definition.type,
			chartDatasets.datasets[definition.type] ?? {},
		]),
	) as Pick<Datasets, ChartDatasetType>;

	const datasets = {
		...chartDatasetRecords,
	};

	return {
		datasets,
		loading: chartDatasets.loading,
		errors: chartDatasets.errors,
	};
}
