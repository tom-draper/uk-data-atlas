"use client";

import { useMemo } from "react";
import {
	aggregateDataset,
	type DatasetConfig,
} from "@/lib/helpers/aggregateDataset";
import type { Dataset } from "@/lib/types/datasets";
import type { BoundaryData } from "@/lib/types/boundaries";
import type { MapManager } from "@/lib/helpers/mapManager/mapManager";

/** Memoized chart aggregation with the shared aggregateDataset cache beneath it. */
export function useAggregatedDataset<T extends Dataset>(
	config: DatasetConfig<T>,
	mapManager: MapManager | null,
	boundaryData: BoundaryData,
	location: string | null,
) {
	return useMemo(
		() => aggregateDataset(config, mapManager, boundaryData, location),
		[config.datasets, config.boundaryType, config.keyBy, mapManager, boundaryData, location],
	);
}
