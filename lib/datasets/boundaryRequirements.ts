import type { ChartKey } from "@/lib/context/ChartVisibilityContext";
import type { BoundaryType } from "@/lib/types/boundaries";
import { CHART_DATASET_DEFINITIONS } from "./generated";
import { getChartDefinitions } from "./types";

/**
 * Presentation-level boundary requirements.
 *
 * Boundaries themselves do not decide which charts are visible. Keeping that
 * policy beside the chart registry lets the boundary data layer be reused by
 * importers and non-React callers.
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
	for (const type of alsoNeeded) if (type) needed.add(type);
	return needed;
}

/** The geography a chart dataset is keyed to, without needing an instance. */
export function boundaryTypeForDatasetType(
	datasetType: string | undefined,
): BoundaryType | undefined {
	if (!datasetType) return undefined;
	return CHART_DATASET_DEFINITIONS.find(
		(definition) => definition.type === datasetType,
	)?.boundaryType;
}
