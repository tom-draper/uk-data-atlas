"use client";

import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import { getSequentialColorForValue } from "@/lib/helpers/colorScale/datasetColors";
import type { NumericMapOptionsKey } from "@/lib/types/mapOptions";

/** Keeps card accents aligned with the active numeric map colour scale. */
export function useHeatmapValueColor(
	datasetType: NumericMapOptionsKey | undefined,
	value: number | null | undefined,
): string | null {
	const mapOptions = useCurrentMapOptions();
	if (datasetType === undefined || value === null || value === undefined)
		return null;

	const mapOption = mapOptions[datasetType];
	return getSequentialColorForValue(
		value,
		mapOption.colorRange,
		mapOptions.theme.id,
	);
}
