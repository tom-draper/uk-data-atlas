import type { BoundaryGeojson, EthnicityDataset } from "@lib/types";
import type { MapOptions } from "@lib/types/mapOptions";
import type { MapRenderContext } from "./context";

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

	// Update layers based on mode
	if (mode === "percentage" && mapOptions.ethnicity?.selected) {
		ctx.layerManager.updateEthnicityCategoryPercentageLayers(
			transformedGeojson,
			mapOptions.ethnicity,
			mapOptions.visibility,
			isDark,
		);
	} else {
		ctx.layerManager.updateEthnicityMajorityLayers(
			transformedGeojson,
			mapOptions.visibility,
		);
	}

	ctx.eventHandler.setupEventHandlers(dataset.data, codeProp);
}
