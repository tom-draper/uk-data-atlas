// lib/utils/mapManager/mapManager.ts
import { BoundaryGeojson, Features, PropertyKeys } from "@lib/types";
import { MapOptions } from "@lib/types/mapOptions";
import type { Map as MapLibreMap } from "maplibre-gl";
import { LayerManager } from "./layerManager";
import { EventHandler } from "./eventHandler";
import { DatasetAggregator } from "../datasetAggregation";
import { FeatureBuilder } from "./featureBuilder";
import { PropertyDetector, type BoundaryCodeScope } from "./propertyDetector";
import { StatsCache } from "./statsCache";
import type { VectorLineLayer } from "./layers";

import type { MapRenderContext } from "../mapRendering";
import type { MapManagerCallbacks } from "./callbacks";
export type { MapManagerCallbacks } from "./callbacks";

export class MapManager implements MapRenderContext {
	readonly layerManager: LayerManager;
	readonly eventHandler: EventHandler;
	readonly datasetAggregator: DatasetAggregator;
	readonly featureBuilder: FeatureBuilder;
	private propertyDetector: PropertyDetector;
	private cache: StatsCache;
	private activeTransformedGeojson:
		| {
				boundary: BoundaryGeojson;
				dataset: object;
				mode: string;
				geojson: BoundaryGeojson;
		  }
		| undefined;
	// Which code key a boundary file uses depends only on the property names it
	// carries, so a detection is reused across every file sharing that schema.
	private codePropCache = new Map<string, PropertyKeys>();

	constructor(map: MapLibreMap, callbacks: MapManagerCallbacks) {
		this.layerManager = new LayerManager(map);
		this.eventHandler = new EventHandler(map, callbacks);
		this.propertyDetector = new PropertyDetector();
		this.featureBuilder = new FeatureBuilder();
		this.cache = new StatsCache();
		this.datasetAggregator = new DatasetAggregator(
			this.propertyDetector,
			this.cache,
		);
	}

	codeProp(scope: BoundaryCodeScope, features: Features): PropertyKeys {
		const properties = features[0]?.properties;
		const cacheKey = `${scope}-${properties ? Object.keys(properties).join(",") : ""}`;

		let codeProp = this.codePropCache.get(cacheKey);
		if (!codeProp) {
			codeProp = this.propertyDetector.detect(scope, features);
			this.codePropCache.set(cacheKey, codeProp);
		}
		return codeProp;
	}

	// The transformed geojson the recipes paint. Rebuilding it is the expensive
	// half of an update, so the most recent one is kept and reused whenever the
	// boundary, dataset and mode all match.
	transformed<T extends object>(
		boundary: BoundaryGeojson,
		dataset: T,
		mode: string,
		build: () => BoundaryGeojson,
	): BoundaryGeojson {
		const cached = this.activeTransformedGeojson;
		if (
			cached?.boundary === boundary &&
			cached.dataset === dataset &&
			cached.mode === mode
		) {
			return cached.geojson;
		}

		const transformed = build();
		this.activeTransformedGeojson = {
			boundary,
			dataset,
			mode,
			geojson: transformed,
		};
		return transformed;
	}

	clearCustomPoints(): void {
		this.layerManager.clearPointLayers();
	}

	setBorderVisibility(hidden: boolean): void {
		this.layerManager.setBorderVisibility(hidden);
	}

	updateVisibility(visibility: MapOptions["visibility"]): void {
		this.layerManager.updateVisibility(visibility);
	}

	updateVectorLineLayer(layer: VectorLineLayer): void {
		this.layerManager.render(layer);
		this.clearMapDataLayers();
	}

	clearMapDataLayers(): void {
		// A network is a map-native dataset, not an overlay on the previously
		// selected choropleth or point dataset. Render first because clearing the
		// boundary source can briefly make the style unavailable.
		this.layerManager.clearBoundaryData();
		this.layerManager.clearPointLayers();
	}

	clearVectorLineLayer(id: string): void {
		this.layerManager.clearLineLayer(id, true);
	}

	countRenderedFeaturesByProperty(
		id: string,
		property: string,
	): Record<string, number> | null {
		return this.layerManager.countRenderedFeaturesByProperty(id, property);
	}

	onIdle(callback: () => void): () => void {
		return this.layerManager.onIdle(callback);
	}

	destroy(): void {
		this.eventHandler.destroy();
		this.codePropCache.clear();
		this.activeTransformedGeojson = undefined;
	}
}
