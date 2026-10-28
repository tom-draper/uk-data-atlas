import { polygonWidthM } from "@uk-data-atlas/map-tiles/equalAreaProjection";
import { toPolygons } from "../../shared/areaGeometryPieces";
import type { AreaOverlapCrosswalkAdapter } from "../../shared/crosswalkAdapters";

export const classify = (
	adapter: Pick<
		AreaOverlapCrosswalkAdapter,
		| "sliverWidthM"
		| "excludedPairs"
		| "includedPairs"
		| "indeterminatePairs"
	>,
	source: string,
	target: string,
	geometry: unknown,
) => {
	const width = Math.max(
		0,
		...toPolygons(geometry, `${source}|${target}`).map(polygonWidthM),
	);
	const excluded = adapter.excludedPairs?.[source]?.[target] !== undefined;
	const included = adapter.includedPairs?.[source]?.[target] !== undefined;
	const indeterminate =
		width >= adapter.sliverWidthM / 2 && width < adapter.sliverWidthM * 2;
	return {
		width,
		indeterminate,
		includedOutsideBand: included && !indeterminate,
		unresolved:
			!excluded &&
			!included &&
			indeterminate &&
			!adapter.indeterminatePairs,
		keep:
			!excluded &&
			(included ||
				(indeterminate && !!adapter.indeterminatePairs) ||
				width >= adapter.sliverWidthM),
	};
};
