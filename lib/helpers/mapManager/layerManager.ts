import type { Map as MapLibreMap } from "maplibre-gl";
import type { BoundaryGeojson } from "@/lib/types/geometry";
import type { MapOptions } from "@/lib/types/mapOptions";
import type { MapLayer } from "./layers";
import type { FillPaintConfig } from "./expressions";
import { valuePaint } from "../mapRendering/fillPaint";
import { BoundaryLayerController } from "./boundaryLayers";
import { LineLayerController } from "./lineLayers";
import { PointLayerController } from "./pointLayers";

/**
 * Public map-layer facade. Each controller owns one independent MapLibre
 * resource family while callers retain the original, declarative API.
 */
export class LayerManager {
	private readonly boundaries: BoundaryLayerController;
	private readonly points: PointLayerController;
	private readonly lines: LineLayerController;

	constructor(private readonly map: MapLibreMap) {
		this.boundaries = new BoundaryLayerController(map);
		this.points = new PointLayerController(map);
		this.lines = new LineLayerController(map);
	}

	render(layer: MapLayer): void {
		switch (layer.kind) {
			case "boundary-fill":
				this.paintBoundaries(
					layer.data,
					valuePaint(layer.colorExpression),
					layer.visibility,
				);
				return;
			case "points":
				this.points.update(
					layer.data,
					layer.visibility,
					layer.radius,
					layer.tooltip,
					layer.isDark,
				);
				return;
			case "line":
				this.lines.update(layer);
				return;
			case "vector-line":
				this.lines.updateVector(layer);
				return;
		}
	}

	paintBoundaries(
		geojson: BoundaryGeojson,
		paint: FillPaintConfig,
		visibility: MapOptions["visibility"],
	): void {
		this.boundaries.paint(geojson, paint, visibility);
	}

	updateVisibility(visibility: MapOptions["visibility"]): void {
		this.boundaries.updateVisibility(visibility);
	}

	clearPointLayers(): void {
		this.points.clear();
	}

	clearLineLayer(id: string, vector = false): void {
		this.lines.clear(id, vector);
	}

	countRenderedFeaturesByProperty(
		id: string,
		property: string,
	): Record<string, number> | null {
		return this.lines.countRenderedFeaturesByProperty(id, property);
	}

	onIdle(callback: () => void): () => void {
		this.map.on("idle", callback);
		return () => this.map.off("idle", callback);
	}

	clearBoundaryData(): void {
		this.boundaries.clear();
	}

	setBorderVisibility(hidden: boolean): void {
		this.boundaries.setBorderVisibility(hidden);
	}
}
