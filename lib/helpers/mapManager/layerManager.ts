// lib/utils/mapManager/layerManager.ts
import { Popup, type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import { BoundaryGeojson } from "@lib/types/geometry";
import { Party, PartyCode } from "@lib/types/common";
import {
	LocalElectionOptions,
	GeneralElectionOptions,
	MapOptions,
	EthnicityOptions,
} from "@lib/types/mapOptions";
import { PARTIES } from "@/lib/data/election/parties";
import { ETHNICITY_COLORS } from "../colorScale/ethnicityColors";
import { getPercentageColorExpression } from "../colorScale/datasetColors";
import { DEFAULT_COLOR } from "./featureBuilder";
import type { PointTooltip } from "@/lib/types/custom";
import type { MapLayer } from "./layers";
import {
	categoryMatch,
	featureProperty,
	hoverOpacity,
	zoomInterpolate,
	type MapExpression,
	type PaintValue,
} from "./expressions";

const SOURCE_ID = "location-wards";
const FILL_LAYER_ID = "wards-fill";
const LINE_LAYER_ID = "wards-line";
const POINT_SOURCE_ID = "custom-points";
const POINT_LAYER_ID = "custom-points-circle";
const LEGACY_HEAT_LAYER_ID = "custom-points-heat";

// Individual points appear only once they are distinct enough to be useful.
const FADE_MIN_ZOOM = 6;
const FADE_MAX_ZOOM = 9;

const EMPTY_FC = { type: "FeatureCollection", features: [] } as const;

type FillPaintConfig = {
	color: PaintValue<string>;
	opacity: (overlayOpacity: number) => PaintValue<number>;
};

export class LayerManager {
	private lastFillPaint: FillPaintConfig | null = null;
	private sourceGeojson: BoundaryGeojson | null = null;
	private pointTooltip: PointTooltip | undefined;
	private pointTooltipDark = false;
	private pointTooltipHandlersAttached = false;
	private pointPopup: Popup | null = null;

	constructor(private map: MapLibreMap) {}

	/** Dispatches a declarative map layer to its renderer. */
	render(layer: MapLayer): void {
		switch (layer.kind) {
			case "boundary-fill":
				this.updateValueLayers(
					layer.data,
					layer.colorExpression,
					layer.visibility,
				);
				return;
			case "points":
				this.updatePointLayers(
					layer.data,
					layer.visibility,
					"viridis",
					layer.radius,
					layer.tooltip,
					layer.isDark,
				);
				return;
			case "line":
				this.updateLineLayer(layer);
				return;
		}
	}

	updateElectionLayers(
		geojson: BoundaryGeojson,
		partyInfo: Party[],
		visibility: MapOptions["visibility"],
	): void {
		const colorExpression = categoryMatch(
			"winningParty",
			partyInfo.map((party) => [party.key, PARTIES[party.key].color] as const),
			"#cccccc",
		);

		this.updateLayers(
			geojson,
			{
				color: colorExpression,
				opacity: hoverOpacity,
			},
			visibility,
		);
	}

	updatePartyPercentageLayers(
		geojson: BoundaryGeojson,
		options: LocalElectionOptions | GeneralElectionOptions,
		visibility: MapOptions["visibility"],
		isDark = false,
	): void {
		if (!options.selected) return;
		const baseColor =
			PARTIES[options.selected as PartyCode]?.color || "#999999";
		const fillColorExpression = getPercentageColorExpression(
			baseColor,
			options,
			isDark,
		);

		this.updateLayers(
			geojson,
			{
				color: fillColorExpression,
				opacity: (opacity) => opacity,
			},
			visibility,
		);
	}

	updateEthnicityMajorityLayers(
		geojson: BoundaryGeojson,
		visibility: MapOptions["visibility"],
	): void {
		const colorExpression = categoryMatch(
			"majorityCategory",
			Object.entries(ETHNICITY_COLORS),
			"#cccccc",
		);

		this.updateLayers(
			geojson,
			{
				color: colorExpression,
				opacity: hoverOpacity,
			},
			visibility,
		);
	}

	updateEthnicityCategoryPercentageLayers(
		geojson: BoundaryGeojson,
		options: EthnicityOptions,
		visibility: MapOptions["visibility"],
		isDark = false,
	): void {
		if (!options.selected) return;
		const baseColor = ETHNICITY_COLORS[options.selected];

		const fillColorExpression = getPercentageColorExpression(
			baseColor,
			options,
			isDark,
		);

		this.updateLayers(
			geojson,
			{
				color: fillColorExpression,
				opacity: (opacity) => opacity,
			},
			visibility,
		);
	}

	updateColoredLayers(
		geojson: BoundaryGeojson,
		visibility: MapOptions["visibility"],
	): void {
		this.updateLayers(
			geojson,
			{
				color: featureProperty("color"),
				opacity: hoverOpacity,
			},
			visibility,
		);
	}

	updateValueLayers(
		geojson: BoundaryGeojson,
		colorExpression: MapExpression,
		visibility: MapOptions["visibility"],
	): void {
		this.updateLayers(
			geojson,
			{
				color: colorExpression,
				opacity: hoverOpacity,
			},
			visibility,
		);
	}

	private updateLayers(
		geojson: BoundaryGeojson,
		paint: FillPaintConfig,
		visibility: MapOptions["visibility"],
	): void {
		this.lastFillPaint = paint;
		const styleLoaded = this.map.isStyleLoaded();
		const sourceExists = !!this.map.getSource(SOURCE_ID);
		const fillLayerExists = !!this.map.getLayer(FILL_LAYER_ID);
		const lineLayerExists = !!this.map.getLayer(LINE_LAYER_ID);
		if (!styleLoaded) return;

		if (sourceExists && fillLayerExists && lineLayerExists) {
			if (this.sourceGeojson !== geojson) {
				// Update source data in-place to avoid remove/add flash.
				const src = this.map.getSource(SOURCE_ID) as GeoJSONSource;
				src.setData(geojson as any);
				this.sourceGeojson = geojson;
			}
			this.applyVisibility(visibility);
			return;
		}

		// First render: remove any partial state then build from scratch
		this.removeExistingLayers();
		this.addSource(geojson);
		this.sourceGeojson = geojson;

		this.map.addLayer({
			id: FILL_LAYER_ID,
			type: "fill",
			source: SOURCE_ID,
			paint: {
				"fill-color": DEFAULT_COLOR,
				"fill-opacity": 0,
			},
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

	private applyVisibility(visibility: MapOptions["visibility"]): void {
		if (!this.lastFillPaint) return;
		if (!this.map.getLayer(FILL_LAYER_ID) || !this.map.getLayer(LINE_LAYER_ID))
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

	// --- Custom point datasets (coordinates / postcodes) ---

	updatePointLayers(
		collection: GeoJSON.FeatureCollection,
		visibility: MapOptions["visibility"],
		_themeId: string,
		radius: { min: number; max: number } = { min: 3, max: 7 },
		tooltip?: PointTooltip,
		isDark = false,
	): void {
		if (!this.map.isStyleLoaded()) return;
		// Remove the old aggregate layer during hot reloads or after switching
		// from an earlier version of the point renderer.
		if (this.map.getLayer(LEGACY_HEAT_LAYER_ID)) {
			this.map.removeLayer(LEGACY_HEAT_LAYER_ID);
		}

		const existing = this.map.getSource(POINT_SOURCE_ID) as
			| GeoJSONSource
			| undefined;
		if (existing) {
			existing.setData(collection as any);
		} else {
			this.map.addSource(POINT_SOURCE_ID, {
				type: "geojson",
				data: collection as any,
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
			zoomInterpolate([[FADE_MIN_ZOOM, radius.min], [10, radius.max]]),
		);
		this.pointTooltip = tooltip;
		this.pointTooltipDark = isDark;
		this.pointPopup?.removeClassName("atlas-point-popup--dark");
		if (isDark) this.pointPopup?.addClassName("atlas-point-popup--dark");
		if (tooltip?.fields.length) {
			this.addPointTooltipHandlers();
		} else {
			this.removePointTooltipHandlers();
		}

		const o = visibility.overlayOpacity ?? 0.6;
		const circleMax = visibility.hideDataLayer ? 0 : Math.min(1, o + 0.3);
		// Circles fade in as we zoom past FADE_MIN_ZOOM.
		this.map.setPaintProperty(
			POINT_LAYER_ID,
			"circle-opacity",
			zoomInterpolate([[FADE_MIN_ZOOM, 0], [FADE_MAX_ZOOM, circleMax]]),
		);
	}

	clearPointLayers(): void {
		this.removePointTooltipHandlers();
		if (this.map.getLayer(POINT_LAYER_ID))
			this.map.removeLayer(POINT_LAYER_ID);
		if (this.map.getLayer(LEGACY_HEAT_LAYER_ID))
			this.map.removeLayer(LEGACY_HEAT_LAYER_ID);
		if (this.map.getSource(POINT_SOURCE_ID))
			this.map.removeSource(POINT_SOURCE_ID);
	}

	private updateLineLayer(layer: Extract<MapLayer, { kind: "line" }>): void {
		if (!this.map.isStyleLoaded()) return;
		const sourceId = `atlas-line-${layer.id}`;
		const layerId = `${sourceId}-stroke`;
		const source = this.map.getSource(sourceId) as GeoJSONSource | undefined;
		if (source) {
			source.setData(layer.data as any);
		} else {
			this.map.addSource(sourceId, { type: "geojson", data: layer.data as any });
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

		this.map.setPaintProperty(layerId, "line-color", layer.style.color);
		this.map.setPaintProperty(layerId, "line-width", layer.style.width);
		this.map.setPaintProperty(
			layerId,
			"line-opacity",
			layer.visibility.hideDataLayer ? 0 : (layer.style.opacity ?? 1),
		);
	}

	private addPointTooltipHandlers(): void {
		if (this.pointTooltipHandlersAttached) return;
		this.map.on("mouseenter", POINT_LAYER_ID, this.handlePointMouseEnter as any);
		this.map.on("mouseleave", POINT_LAYER_ID, this.handlePointMouseLeave as any);
		this.pointTooltipHandlersAttached = true;
	}

	private removePointTooltipHandlers(): void {
		if (!this.pointTooltipHandlersAttached) return;
		this.map.off("mouseenter", POINT_LAYER_ID, this.handlePointMouseEnter as any);
		this.map.off("mouseleave", POINT_LAYER_ID, this.handlePointMouseLeave as any);
		this.pointTooltipHandlersAttached = false;
		this.pointTooltip = undefined;
		this.pointTooltipDark = false;
		this.pointPopup?.remove();
	}

	private handlePointMouseEnter = (event: any): void => {
		if (this.map.getZoom() < FADE_MAX_ZOOM || !this.pointTooltip) return;
		const properties = event.features?.[0]?.properties as
			| Record<string, string | number>
			| undefined;
		if (!properties) return;

		this.map.getCanvas().style.cursor = "pointer";
		const content = document.createElement("div");
		content.className = "atlas-point-popup__body";
		const heading = document.createElement("p");
		heading.className = "atlas-point-popup__heading";
		heading.textContent = this.pointTooltip.title;
		content.appendChild(heading);

		this.pointTooltip.fields.forEach((field, index) => {
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

		if (!this.pointPopup) {
			this.pointPopup = new Popup({
				closeButton: false,
				closeOnClick: false,
				offset: 8,
			}).addClassName("atlas-point-popup");
			if (this.pointTooltipDark) {
				this.pointPopup.addClassName("atlas-point-popup--dark");
			}
		}
		this.pointPopup.setLngLat(event.lngLat).setDOMContent(content).addTo(this.map);
	};

	private handlePointMouseLeave = (): void => {
		this.map.getCanvas().style.cursor = "";
		this.pointPopup?.remove();
	};

	// Blanks the choropleth fill/line without tearing the source down — used when
	// switching to a point dataset so stale boundary data doesn't linger beneath.
	clearBoundaryData(): void {
		this.sourceGeojson = null;
		const src = this.map.getSource(SOURCE_ID) as
			| GeoJSONSource
			| undefined;
		if (src) src.setData(EMPTY_FC as any);
	}

	private static readonly BASE_BOUNDARY_LAYERS = [
		"boundary_county",
		"boundary_state",
		"boundary_country_outline",
		"boundary_country_inner",
	];

	setBorderVisibility(hidden: boolean): void {
		if (!this.map.isStyleLoaded()) return;
		const opacity = hidden ? 0 : 1;
		if (this.map.getLayer(LINE_LAYER_ID)) {
			this.map.setPaintProperty(LINE_LAYER_ID, "line-opacity", hidden ? 0 : 0.05);
		}
		for (const layerId of LayerManager.BASE_BOUNDARY_LAYERS) {
			if (this.map.getLayer(layerId)) {
				this.map.setPaintProperty(layerId, "line-opacity", opacity);
			}
		}
	}

	private removeExistingLayers(): void {
		this.sourceGeojson = null;
		const source = (this.map as any).getSource(SOURCE_ID);
		if (source) {
			if (this.map.getLayer(FILL_LAYER_ID))
				this.map.removeLayer(FILL_LAYER_ID);
			if (this.map.getLayer(LINE_LAYER_ID))
				this.map.removeLayer(LINE_LAYER_ID);
			this.map.removeSource(SOURCE_ID);
		}
	}

	private addSource(geojson: BoundaryGeojson): void {
		this.map.addSource(SOURCE_ID, {
			type: "geojson",
			data: geojson,
		});
	}
}
