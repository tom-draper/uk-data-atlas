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

/**
 * Whether a dataset is worth fetching: a visible card reads it, or the map is
 * drawing it.
 *
 * The active visualisation counts even when its own card is hidden, which
 * mirrors `requiredBoundaryTypes` keeping that visualisation's geography loaded
 * on the same grounds. Six datasets ship with every card hidden by default (the
 * Hanretty estimates, the Scottish, Welsh and Northern Irish deprivation
 * indices, and two school performance breakdowns), so without this a link to one
 * of them opened by anyone on default settings drew an empty map.
 */
export function datasetIsNeeded(
	definition: (typeof CHART_DATASET_DEFINITIONS)[number],
	visibility: Record<ChartKey, boolean>,
	activeDatasetType?: string,
): boolean {
	if (definition.type === activeDatasetType) return true;
	return getChartDefinitions(definition).some(
		(chart) => visibility[chart.key] ?? DEFAULT_VISIBILITY[chart.key],
	);
}

/**
 * The chart datasets for the current view.
 *
 * @param activeDatasetType The dataset the map is drawing, kept loaded whether
 * or not its card is shown. See `datasetIsNeeded`.
 */
export function useDatasets(
	selectedLocation: string,
	activeDatasetType?: string,
): UseDatasetsResult {
	const visibility = useSyncExternalStore(
		subscribeVisibility,
		getVisibilitySnapshot,
		getServerSnapshot,
	);

	const chartDatasets = useJsonDatasetLoaders(
		CHART_DATASET_DEFINITIONS.map((definition) => ({
			key: definition.type,
			url: withCDN(
				`/data/precompiled/${definition.precompiledFile}.json`,
			),
			filter: {
				location: selectedLocation,
				boundaryType: definition.boundaryType,
				payloadLayout: definition.payload,
				includeLocationPopulationSummary:
					definition.payload?.regionChunks?.populationSummary ===
					true,
			},
			chunkUrls: definition.payload?.regionChunks
				? (regionChunksForLocation(selectedLocation)?.map((region) =>
						withCDN(
							regionChunkPath(definition.precompiledFile, region),
						),
					) ?? undefined)
				: undefined,
			enabled: datasetIsNeeded(definition, visibility, activeDatasetType),
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
