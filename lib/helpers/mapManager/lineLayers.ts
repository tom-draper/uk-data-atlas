import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { MapLayer } from "./layers";

export class LineLayerController {
	constructor(private readonly map: MapLibreMap) {}

	update(layer: Extract<MapLayer, { kind: "line" }>): void {
		if (!this.map.isStyleLoaded()) return;
		const sourceId = `atlas-line-${layer.id}`;
		const layerId = `${sourceId}-stroke`;
		const source = this.map.getSource(sourceId) as
			GeoJSONSource | undefined;
		if (source) {
			source.setData(layer.data);
		} else {
			this.map.addSource(sourceId, { type: "geojson", data: layer.data });
			this.map.addLayer({
				id: layerId,
				type: "line",
				source: sourceId,
				paint: {
					"line-color": layer.style.color,
					"line-width": layer.style.width,
				},
			});
		}
		this.applyStyle(layerId, layer.style, layer.visibility.hideDataLayer);
	}

	updateVector(layer: Extract<MapLayer, { kind: "vector-line" }>): void {
		if (!this.map.isStyleLoaded()) return;
		const sourceId = `atlas-vector-line-${layer.id}`;
		const layerId = `${sourceId}-stroke`;
		if (!this.map.getSource(sourceId)) {
			this.map.addSource(sourceId, {
				type: "vector",
				tiles: layer.source.tiles,
				minzoom: layer.source.minzoom,
				maxzoom: layer.source.maxzoom,
				attribution: layer.source.attribution,
			});
		}
		if (!this.map.getLayer(layerId)) {
			this.map.addLayer({
				id: layerId,
				type: "line",
				source: sourceId,
				"source-layer": layer.source.sourceLayer,
				paint: {
					"line-color": layer.style.color,
					"line-width": layer.style.width,
				},
			});
		}
		this.applyStyle(layerId, layer.style, layer.visibility.hideDataLayer);
		this.map.setFilter(layerId, layer.filter ?? null);
	}

	clear(id: string, vector = false): void {
		const sourceId = `${vector ? "atlas-vector-line" : "atlas-line"}-${id}`;
		const layerId = `${sourceId}-stroke`;
		if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
		if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);
	}

	countRenderedFeaturesByProperty(
		id: string,
		property: string,
	): Record<string, number> | null {
		const layerId = `atlas-vector-line-${id}-stroke`;
		if (!this.map.getLayer(layerId)) return null;
		const counts: Record<string, number> = {};
		for (const feature of this.map.queryRenderedFeatures({
			layers: [layerId],
		})) {
			const value = feature.properties?.[property];
			const key = typeof value === "string" ? value : "Unknown";
			counts[key] = (counts[key] ?? 0) + 1;
		}
		return counts;
	}

	private applyStyle(
		layerId: string,
		style: Extract<MapLayer, { kind: "line" | "vector-line" }>["style"],
		hidden: boolean,
	): void {
		this.map.setPaintProperty(layerId, "line-color", style.color);
		this.map.setPaintProperty(layerId, "line-width", style.width);
		this.map.setPaintProperty(
			layerId,
			"line-opacity",
			hidden ? 0 : (style.opacity ?? 1),
		);
	}
}
