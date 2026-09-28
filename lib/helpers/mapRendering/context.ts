/**
 * What a rendering recipe needs from the map session. MapManager owns the
 * MapLibre collaborators and the caches; the recipes below only paint, so they
 * take this context rather than reaching for the map itself.
 */
import type { BoundaryGeojson, Features, PropertyKeys } from "@lib/types";
import type { EventHandler } from "../mapManager/eventHandler";
import type { FeatureBuilder } from "../mapManager/featureBuilder";
import type { LayerManager } from "../mapManager/layerManager";
import type { BoundaryCodeScope } from "../mapManager/propertyDetector";

export interface MapRenderContext {
	readonly layerManager: LayerManager;
	readonly eventHandler: EventHandler;
	readonly featureBuilder: FeatureBuilder;

	/** The property key a boundary file uses for a geography's area codes. */
	codeProp(scope: BoundaryCodeScope, features: Features): PropertyKeys;

	/**
	 * The transformed geojson for a boundary/dataset/mode triple, rebuilt only
	 * when one of the three changes.
	 */
	transformed(
		boundary: BoundaryGeojson,
		dataset: object,
		mode: string,
		build: () => BoundaryGeojson,
	): BoundaryGeojson;
}

/** Transformed geojson whose features carry the numeric `value` to colour by. */
export function valueGeojson<T extends object>(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: T,
	mode: string,
	codeProp: PropertyKeys,
	valueFor: (
		code: string,
		feature: Features[number],
	) => number | null | undefined,
): BoundaryGeojson {
	return ctx.transformed(geojson, dataset, mode, () =>
		ctx.featureBuilder.formatBoundaryGeoJson(
			ctx.featureBuilder.buildValueFeatures(
				geojson.features,
				codeProp,
				valueFor,
			),
		),
	);
}
