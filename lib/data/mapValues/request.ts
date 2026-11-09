import type { BoundaryTiles } from "@/lib/data/boundaries/tiles";
import type { NumericMapConfig } from "@/lib/helpers/mapRendering/numeric";
import type { MapValuesRequest } from "./mapValues";

/**
 * The array a numeric map would colour from, when its value is one plain field
 * of each record. A map that derives its value (`valueFor`), varies it with an
 * option (`sourceMode`) or picks its range from the data (`getColorRange`)
 * keeps the join, as does one with nothing to address by id.
 */
export function mapValuesRequestFor(
	dataset: { type: string; year?: number },
	tiles: BoundaryTiles | null | undefined,
	map: Pick<
		NumericMapConfig<never>,
		"valueKey" | "valueFor" | "sourceMode" | "getColorRange"
	>,
): MapValuesRequest | null {
	if (!tiles || !map.valueKey || typeof dataset.year !== "number")
		return null;
	if (map.valueFor || map.sourceMode || map.getColorRange) return null;
	return {
		measure: dataset.type,
		field: map.valueKey,
		release: tiles.release,
		year: dataset.year,
		codeList: tiles.codeList,
	};
}
