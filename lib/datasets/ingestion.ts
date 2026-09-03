import {
	validatePrecompiledDataset as validateCoreDataset,
	type DatasetPrecompileSummary,
} from "../data/catalog";
import type { ChartDatasetDefinition } from "./types";

export type {
	DatasetIngestionContract,
	DatasetPrecompileSummary,
	SourceArtifact,
} from "../data/catalog";

/**
 * Presentation-registry validation kept at the web boundary while datasets
 * migrate to the framework-neutral catalogue. Core validation deliberately
 * knows nothing about charts or MapLibre boundary types.
 */
export function validatePrecompiledDataset<
	T extends { type: string; data: unknown },
>(
	definition: ChartDatasetDefinition<T>,
	compiled: Record<string, T>,
): DatasetPrecompileSummary {
	const summary = validateCoreDataset(definition, compiled);
	const expectedBoundaryType = definition.chart.boundaryType;
	for (const [key, value] of Object.entries(compiled)) {
		const boundaryType = (value as { boundaryType?: unknown }).boundaryType;
		if (boundaryType !== expectedBoundaryType) {
			throw new Error(
				`${definition.type}: ${key} uses ${String(boundaryType)} boundaries; expected ${expectedBoundaryType}.`,
			);
		}
	}
	return summary;
}
