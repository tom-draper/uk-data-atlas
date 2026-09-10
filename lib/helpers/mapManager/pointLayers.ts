import {
	Popup,
	type GeoJSONSource,
	type Map as MapLibreMap,
} from "maplibre-gl";
import type { PointTooltip } from "@/lib/types/custom";
import type { MapOptions } from "@/lib/types/mapOptions";
import type { MapLayerMouseHandler } from "./callbacks";
import { featureProperty, zoomInterpolate } from "./expressions";

const POINT_SOURCE_ID = "custom-points";
const POINT_LAYER_ID = "custom-points-circle";
const LEGACY_HEAT_LAYER_ID = "custom-points-heat";
const FADE_MIN_ZOOM = 6;
const FADE_MAX_ZOOM = 9;

export class PointLayerController {
	private tooltip: PointTooltip | undefined;
	private tooltipIsDark = false;
	private tooltipHandlersAttached = false;
	private popup: Popup | null = null;

	constructor(private readonly map: MapLibreMap) {}

	update(
		collection: GeoJSON.FeatureCollection,
		visibility: MapOptions["visibility"],
		radius: { min: number; max: number } = { min: 3, max: 7 },
		tooltip?: PointTooltip,
		isDark = false,
	): void {
		if (!this.map.isStyleLoaded()) return;
		if (this.map.getLayer(LEGACY_HEAT_LAYER_ID))
			this.map.removeLayer(LEGACY_HEAT_LAYER_ID);

		const existing = this.map.getSource(POINT_SOURCE_ID) as
			GeoJSONSource | undefined;
		if (existing) {
			existing.setData(collection);
		} else {
			this.map.addSource(POINT_SOURCE_ID, {
				type: "geojson",
				data: collection,
			});
			this.map.addLayer({
				id: POINT_LAYER_ID,
				type: "circle",
				source: POINT_SOURCE_ID,
				paint: {
					"circle-radius": radius.min,
					"circle-color": featureProperty("color"),
				},
			});
		}

		this.map.setPaintProperty(
			POINT_LAYER_ID,
			"circle-radius",
			zoomInterpolate([
				[FADE_MIN_ZOOM, radius.min],
				[10, radius.max],
			]),
		);
		this.tooltip = tooltip;
		this.tooltipIsDark = isDark;
		this.popup?.removeClassName("atlas-point-popup--dark");
		if (isDark) this.popup?.addClassName("atlas-point-popup--dark");
		if (tooltip?.fields.length) this.addTooltipHandlers();
		else this.removeTooltipHandlers();

		const opacity = visibility.overlayOpacity ?? 0.6;
		const maxOpacity = visibility.hideDataLayer
			? 0
			: Math.min(1, opacity + 0.3);
		this.map.setPaintProperty(
			POINT_LAYER_ID,
			"circle-opacity",
			zoomInterpolate([
				[FADE_MIN_ZOOM, 0],
				[FADE_MAX_ZOOM, maxOpacity],
			]),
		);
	}

	clear(): void {
		this.removeTooltipHandlers();
		if (this.map.getLayer(POINT_LAYER_ID))
			this.map.removeLayer(POINT_LAYER_ID);
		if (this.map.getLayer(LEGACY_HEAT_LAYER_ID))
			this.map.removeLayer(LEGACY_HEAT_LAYER_ID);
		if (this.map.getSource(POINT_SOURCE_ID))
			this.map.removeSource(POINT_SOURCE_ID);
	}

	private addTooltipHandlers(): void {
		if (this.tooltipHandlersAttached) return;
		this.map.on("mouseenter", POINT_LAYER_ID, this.handleMouseEnter);
		this.map.on("mouseleave", POINT_LAYER_ID, this.handleMouseLeave);
		this.tooltipHandlersAttached = true;
	}

	private removeTooltipHandlers(): void {
		if (!this.tooltipHandlersAttached) return;
		this.map.off("mouseenter", POINT_LAYER_ID, this.handleMouseEnter);
		this.map.off("mouseleave", POINT_LAYER_ID, this.handleMouseLeave);
		this.tooltipHandlersAttached = false;
		this.tooltip = undefined;
		this.tooltipIsDark = false;
		this.popup?.remove();
	}

	private handleMouseEnter: MapLayerMouseHandler = (event) => {
		if (this.map.getZoom() < FADE_MAX_ZOOM || !this.tooltip) return;
		const properties = event.features?.[0]?.properties as
			Record<string, string | number> | undefined;
		if (!properties) return;

		this.map.getCanvas().style.cursor = "pointer";
		const content = document.createElement("div");
		content.className = "atlas-point-popup__body";
		const heading = document.createElement("p");
		heading.className = "atlas-point-popup__heading";
		heading.textContent = this.tooltip.title;
		content.appendChild(heading);
		this.tooltip.fields.forEach((field, index) => {
			const value = properties[`detail${index}`];
			if (value === undefined || value === "") return;
			const row = document.createElement("div");
			row.className = "atlas-point-popup__row";
			const label = document.createElement("span");
			label.className = "atlas-point-popup__label";
			label.textContent = field;
			const detail = document.createElement("span");
			detail.className = "atlas-point-popup__value";
			detail.textContent = String(value);
			row.append(label, detail);
			content.appendChild(row);
		});

		if (!this.popup) {
			this.popup = new Popup({
				closeButton: false,
				closeOnClick: false,
				offset: 8,
			}).addClassName("atlas-point-popup");
			if (this.tooltipIsDark)
				this.popup.addClassName("atlas-point-popup--dark");
		}
		this.popup
			.setLngLat(event.lngLat)
			.setDOMContent(content)
			.addTo(this.map);
	};

	private handleMouseLeave: MapLayerMouseHandler = () => {
		this.map.getCanvas().style.cursor = "";
		this.popup?.remove();
	};
}
