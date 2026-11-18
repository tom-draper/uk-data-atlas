import type { BoundaryGeojson, BoundaryType } from "@lib/types";
import type { MapOptions } from "@lib/types/mapOptions";
import type { CategoryRecords } from "../mapManager/featureBuilder";
import type { MapRenderContext } from "./context";
import { categoryMajorityPaint, categoryPercentagePaint } from "./fillPaint";

/**
 * Draws a dataset mapped by its largest group: each area in the colour of its
 * largest group, or one group's share. The colours are the dataset's own.
 */
export function renderCategories(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: CategoryRecords,
	{
		colors,
		boundary,
	}: { colors: Readonly<Record<string, string>>; boundary: BoundaryType },
	mapOptions: MapOptions,
	isDark = false,
): void {
	const codeProp = ctx.codeProp(boundary, geojson.features);
	const options = mapOptions[dataset.type];
	const mode = options?.mode || "majority";

	const features = ctx.featureBuilder.buildCategoryFeatures(
		geojson.features,
		dataset,
		codeProp,
		mapOptions,
	);

	const transformedGeojson =
		ctx.featureBuilder.formatBoundaryGeoJson(features);

	const paint =
		mode === "percentage"
			? categoryPercentagePaint(colors, options, isDark)
			: categoryMajorityPaint(colors);
	if (paint) {
		ctx.layerManager.paintBoundaries(
			transformedGeojson,
			paint,
			mapOptions.visibility,
		);
	}

	ctx.eventHandler.setupEventHandlers(dataset.data, codeProp);
}
