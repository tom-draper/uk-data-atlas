import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/boundaries";
import { MAX_AREAS } from "@/lib/measures/request";
import { getProp } from "@uk-data-atlas/datasets";
import type { BoundaryData, BoundaryType } from "@uk-data-atlas/datasets";

/**
 * The codes of the areas a card's figure should cover: those the map shows
 * for the chosen location, read from the loaded boundaries. Null while the
 * boundaries are not loaded, so a card waits rather than guessing.
 */
export function areaCodesInScope(
	boundaryData: BoundaryData,
	geography: string,
	boundaryYear: number,
): string[] | null {
	const geojson = boundaryData[geography as BoundaryType]?.[boundaryYear];
	if (!geojson) return null;
	const keys = BOUNDARY_CATALOG[geography as BoundaryType].properties.code;
	const codes = new Set<string>();
	for (const feature of geojson.features) {
		const code = getProp(feature.properties, keys);
		if (code) codes.add(code);
	}
	return [...codes];
}

/**
 * The areas to put in a request for `codes`. A scope too large to list is
 * read as the whole geography instead, which is what it is at that size.
 */
export const requestAreas = (codes: readonly string[]): string[] | undefined =>
	codes.length > MAX_AREAS ? undefined : [...codes];
