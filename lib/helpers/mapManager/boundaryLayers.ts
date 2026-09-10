import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { BoundaryGeojson } from "@/lib/types/geometry";
import type { MapOptions } from "@/lib/types/mapOptions";
import { DEFAULT_COLOR } from "./featureBuilder";
import type { FillPaintConfig } from "./expressions";

const SOURCE_ID = "location-wards";
const FILL_LAYER_ID = "wards-fill";
const LINE_LAYER_ID = "wards-line";

const emptyFeatureCollection = (): FeatureCollection => ({
	type: "FeatureCollection",
	features: [],
});

const asMapData = (geojson: BoundaryGeojson) =>
	geojson as unknown as GeoJSON.FeatureCollection;

export class BoundaryLayerController {
	private lastFillPaint: FillPaintConfig | null = null;
	private sourceGeojson: BoundaryGeojson | null = null;
	private deferredPaint: {
		geojson: BoundaryGeojson;
		paint: FillPaintConfig;
		visibility: MapOptions["visibility"];
	} | null = null;
	private awaitingStyle = false;

	constructor(private readonly map: MapLibreMap) {}

	paint(
		geojson: BoundaryGeojson,
		paint: FillPaintConfig,
		visibility: MapOptions["visibility"],
	): void {
		this.lastFillPaint = paint;
		if (!this.map.isStyleLoaded()) {
			this.deferredPaint = { geojson, paint, visibility };
			if (!this.awaitingStyle) {
				this.awaitingStyle = true;
				this.map.once("idle", () => {
					this.awaitingStyle = false;
					const deferred = this.deferredPaint;
					this.deferredPaint = null;
					if (deferred)
						this.paint(
							deferred.geojson,
							deferred.paint,
							deferred.visibility,
						);
				});
			}
			return;
		}
		this.deferredPaint = null;

		const sourceExists = !!this.map.getSource(SOURCE_ID);
		const fillLayerExists = !!this.map.getLayer(FILL_LAYER_ID);
		const lineLayerExists = !!this.map.getLayer(LINE_LAYER_ID);
		if (sourceExists && fillLayerExists && lineLayerExists) {
			if (this.sourceGeojson !== geojson) {
				(this.map.getSource(SOURCE_ID) as GeoJSONSource).setData(
					asMapData(geojson),
				);
				this.sourceGeojson = geojson;
			}
			this.applyVisibility(visibility);
			return;
		}

		this.removeExistingLayers();
		this.addSource(geojson);
		this.sourceGeojson = geojson;
		this.map.addLayer({
			id: FILL_LAYER_ID,
			type: "fill",
			source: SOURCE_ID,
			paint: { "fill-color": DEFAULT_COLOR, "fill-opacity": 0 },
		});
		this.map.addLayer({
			id: LINE_LAYER_ID,
			type: "line",
			source: SOURCE_ID,
			paint: {
				"line-color": "#000",
				"line-width": 1,
				"line-opacity": 0,
			},
		});
		this.applyVisibility(visibility);
	}

	updateVisibility(visibility: MapOptions["visibility"]): void {
		if (!this.map.isStyleLoaded() || !this.lastFillPaint) return;
		this.applyVisibility(visibility);
	}

	clear(): void {
		this.sourceGeojson = null;
		const source = this.map.getSource(SOURCE_ID) as
			GeoJSONSource | undefined;
		if (source) source.setData(emptyFeatureCollection());
	}

	setBorderVisibility(hidden: boolean): void {
		if (!this.map.isStyleLoaded()) return;
		if (this.map.getLayer(LINE_LAYER_ID)) {
			this.map.setPaintProperty(
				LINE_LAYER_ID,
				"line-opacity",
				hidden ? 0 : 0.05,
			);
		}
		for (const layerId of BASE_BOUNDARY_LAYERS) {
			if (this.map.getLayer(layerId))
				this.map.setPaintProperty(
					layerId,
					"line-opacity",
					hidden ? 0 : 1,
				);
		}
	}

	private applyVisibility(visibility: MapOptions["visibility"]): void {
		if (!this.lastFillPaint) return;
		if (
			!this.map.getLayer(FILL_LAYER_ID) ||
			!this.map.getLayer(LINE_LAYER_ID)
		)
			return;

		const overlayOpacity = visibility.overlayOpacity ?? 0.6;
		const hidden = visibility.hideBoundaryLayer;
		const fillColor = hidden
			? "transparent"
			: visibility.hideDataLayer
				? DEFAULT_COLOR
				: this.lastFillPaint.color;
		const fillOpacity = hidden
			? 0
			: visibility.hideDataLayer
				? overlayOpacity
				: this.lastFillPaint.opacity(overlayOpacity);

		this.map.setPaintProperty(FILL_LAYER_ID, "fill-color", fillColor);
		this.map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", fillOpacity);
		this.map.setPaintProperty(
			LINE_LAYER_ID,
			"line-color",
			hidden ? "transparent" : "#000",
		);
		this.map.setPaintProperty(
			LINE_LAYER_ID,
			"line-opacity",
			hidden || visibility.hideBorders ? 0 : 0.05,
		);
	}

	private removeExistingLayers(): void {
		this.sourceGeojson = null;
		if (!this.map.getSource(SOURCE_ID)) return;
		if (this.map.getLayer(FILL_LAYER_ID))
			this.map.removeLayer(FILL_LAYER_ID);
		if (this.map.getLayer(LINE_LAYER_ID))
			this.map.removeLayer(LINE_LAYER_ID);
		this.map.removeSource(SOURCE_ID);
	}

	private addSource(geojson: BoundaryGeojson): void {
		this.map.addSource(SOURCE_ID, {
			type: "geojson",
			data: asMapData(geojson),
		});
	}
}

const BASE_BOUNDARY_LAYERS = [
	"boundary_county",
	"boundary_state",
	"boundary_country_outline",
	"boundary_country_inner",
];
