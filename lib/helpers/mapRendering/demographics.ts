import type { BoundaryGeojson, EthnicityDataset } from "@lib/types";
import type { MapOptions } from "@lib/types/mapOptions";
import type { MapRenderContext } from "./context";
import { ethnicityMajorityPaint, ethnicityPercentagePaint } from "./fillPaint";

export function renderEthnicity(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: EthnicityDataset,
	mapOptions: MapOptions,
	isDark = false,
): void {
	const codeProp = ctx.codeProp("localAuthority", geojson.features);

	const mode = mapOptions.ethnicity?.mode || "majority";

	// Build features based on mode
	const features = ctx.featureBuilder.buildEthnicityFeatures(
		geojson.features,
		dataset,
		codeProp,
		mapOptions,
	);

	const transformedGeojson =
		ctx.featureBuilder.formatBoundaryGeoJson(features);

	const paint =
		mode === "percentage"
			? ethnicityPercentagePaint(mapOptions.ethnicity, isDark)
			: ethnicityMajorityPaint();
	if (paint) {
		ctx.layerManager.paintBoundaries(
			transformedGeojson,
			paint,
			mapOptions.visibility,
		);
	}

	ctx.eventHandler.setupEventHandlers(dataset.data, codeProp);
}
