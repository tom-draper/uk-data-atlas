import { CHART_DATASET_DEFINITIONS } from "./generated";
import type { ChartDataset } from "./generated";
import type { DatasetDefinition } from "../data/catalog";
import type { ChartDatasetDefinition } from "./types";

/**
 * Removes chart and MapLibre presentation concerns from a dataset definition.
 *
 * Dataset modules are migrated to lib/data/catalog/definitions incrementally.
 * This adapter gives compilers and future non-web consumers one framework-free
 * registry immediately, without copying provenance or ingestion behaviour.
 */
const asCatalogueDefinition = <T extends { type: string; data: unknown }>(
	definition: ChartDatasetDefinition<T>,
): DatasetDefinition<T> => ({
	type: definition.type,
	precompiledFile: definition.precompiledFile,
	boundaryType: definition.chart.boundaryType,
	source: definition.source,
	ingestion: definition.ingestion,
	precompile: definition.precompile,
});

export const CATALOGUE_DATASET_DEFINITIONS: readonly DatasetDefinition<ChartDataset>[] =
	CHART_DATASET_DEFINITIONS.map(asCatalogueDefinition);
