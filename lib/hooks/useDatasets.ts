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
	isChartDatasetPayload,
	type ChartDataset,
	type ChartDatasetType,
} from "@/lib/datasets";
import { getChartDefinitions } from "@/lib/datasets/types";
import { withCDN } from "@/lib/helpers/cdn";
import { payloadKeysQuery } from "@/lib/data/payloadKeys";
import type { ActiveViz } from "@/lib/types";
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

const parseChartDataset = (
	value: unknown,
	datasetType?: string,
): ChartDataset => {
	if (!isChartDatasetPayload(value, datasetType)) {
		throw new Error(
			`Invalid compiled dataset payload for ${datasetType ?? "unknown dataset"}`,
		);
	}
	return value;
};

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
 * Load the active map's dataset first, then the visible cards'. Nothing else
 * is loaded (see `datasetIsNeeded`), so there is no lower tier.
 */
export function datasetLoadPriority(
	definition: (typeof CHART_DATASET_DEFINITIONS)[number],
	activeDatasetType?: string,
): number {
	return definition.type === activeDatasetType ? 0 : 1;
}

/**
 * The payload keys a dataset's view reads, or `null` to fetch them all.
 *
 * A value card reads one year, yet a payload can carry decades of them, so a
 * dataset drawn only by value cards fetches its cards' years, plus the year the
 * map is drawing when it is another (a shared link can name any year). Other
 * charts, such as series and breakdowns, may read every year, and region
 * chunks are already split another way, so both keep the whole payload.
 */
export function datasetPayloadKeys(
	definition: (typeof CHART_DATASET_DEFINITIONS)[number],
	activeViz?: Pick<ActiveViz, "datasetType" | "datasetYear">,
): string[] | null {
	if (definition.payload?.regionChunks) return null;
	const charts = getChartDefinitions(definition);
	if (!charts.every((chart) => chart.card || chart.cardForOptions))
		return null;
	const keys = charts.map((chart) => chart.datasetId ?? String(chart.year));
	if (activeViz?.datasetType === definition.type)
		keys.push(String(activeViz.datasetYear));
	return [...new Set(keys)].sort();
}

function payloadUrl(url: string, keys: string[] | null): string {
	if (!keys) return url;
	return `${url}${url.includes("?") ? "&" : "?"}keys=${payloadKeysQuery(keys)}`;
}

/**
 * The chart datasets for the current view.
 *
 * @param activeViz What the map is drawing, kept loaded whether or not its
 * card is shown. See `datasetIsNeeded`.
 */
export function useDatasets(
	datasetUrls: Readonly<Record<string, string>>,
	selectedLocation: string,
	activeViz?: Pick<ActiveViz, "datasetType" | "datasetYear">,
): UseDatasetsResult {
	const activeDatasetType = activeViz?.datasetType;
	const visibility = useSyncExternalStore(
		subscribeVisibility,
		getVisibilitySnapshot,
		getServerSnapshot,
	);

	const chartDatasets = useJsonDatasetLoaders(
		CHART_DATASET_DEFINITIONS.map((definition) => ({
			key: definition.type,
			url: payloadUrl(
				datasetUrls[definition.precompiledFile]!,
				datasetPayloadKeys(definition, activeViz),
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
			priority: datasetLoadPriority(definition, activeDatasetType),
			enabled: datasetIsNeeded(definition, visibility, activeDatasetType),
		})),
		parseChartDataset,
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
