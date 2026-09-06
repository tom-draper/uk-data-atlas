import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { getChartDefinitions } from "@/lib/datasets/types";
import type { ChartKey } from "@/lib/context/ChartVisibilityContext";
import type { BoundaryType } from "./catalog";

/**
 * The geographies worth downloading for a given set of visible charts.
 *
 * The atlas serves far more boundaries than its own datasets use — the extra
 * ones exist so an uploaded file can be matched against whatever geography it
 * happens to be keyed by — and every one of them used to be fetched before the
 * first paint. A chart can only aggregate against the geography its dataset is
 * keyed to, so a geography no visible chart names is not needed yet, and is
 * fetched when something asks for it.
 */
export function requiredBoundaryTypes(
	visibility: Record<ChartKey, boolean>,
	alsoNeeded: readonly (BoundaryType | undefined)[] = [],
): Set<BoundaryType> {
	const needed = new Set<BoundaryType>();
	for (const definition of CHART_DATASET_DEFINITIONS) {
		const shown = getChartDefinitions(definition).some(
			(chart) => visibility[chart.key],
		);
		if (shown) needed.add(definition.boundaryType);
	}
	// The active visualisation stays loaded even if its chart is hidden.
	for (const type of alsoNeeded) if (type) needed.add(type);
	return needed;
}

/** The geography a dataset type is keyed to, without needing an instance. */
export function boundaryTypeForDatasetType(
	datasetType: string | undefined,
): BoundaryType | undefined {
	if (!datasetType) return undefined;
	return CHART_DATASET_DEFINITIONS.find(
		(definition) => definition.type === datasetType,
	)?.boundaryType;
}
