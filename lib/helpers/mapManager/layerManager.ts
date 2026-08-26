// lib/utils/mapManager/layerManager.ts
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
import { buildHeatmapColorRamp } from "../colorScale/themes";
import { DEFAULT_COLOR } from "./featureBuilder";

const SOURCE_ID = "location-wards";
const FILL_LAYER_ID = "wards-fill";
const LINE_LAYER_ID = "wards-line";
const POINT_SOURCE_ID = "custom-points";
const POINT_LAYER_ID = "custom-points-circle";
const HEAT_LAYER_ID = "custom-points-heat";

// Cross-fade between the heatmap (zoomed out, where individual points overlap
// into noise) and discrete circles (zoomed in, where each point is meaningful).
const FADE_MIN_ZOOM = 6;
const FADE_MAX_ZOOM = 9;

const EMPTY_FC = { type: "FeatureCollection", features: [] } as const;

type FillPaintConfig = {
	color: any;
	opacity: (overlayOpacity: number) => number | any[];
};

export class LayerManager {
	private lastFillPaint: FillPaintConfig | null = null;

	constructor(private map: maplibregl.Map) {}

	updateElectionLayers(
		geojson: BoundaryGeojson,
		partyInfo: Party[],
		visibility: MapOptions["visibility"],
	): void {
		const colorExpression: any[] = ["match", ["get", "winningParty"]];
		partyInfo.forEach((party) => {
			colorExpression.push(party.key, PARTIES[party.key].color);
		});
		colorExpression.push("#cccccc");

		this.updateLayers(
			geojson,
			{
				color: colorExpression,
				opacity: (opacity) => [
					"case",
					["boolean", ["feature-state", "hover"], false],
					opacity * 0.58,
					opacity,
				],
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
		const colorExpression: any[] = ["match", ["get", "majorityCategory"]];

		Object.entries(ETHNICITY_COLORS).forEach(([ethnicity, color]) => {
			colorExpression.push(ethnicity, color);
		});

		// Fallback color for 'NONE' or missing data
		colorExpression.push("#cccccc");

		this.updateLayers(
			geojson,
			{
				color: colorExpression,
				opacity: (opacity) => [
					"case",
					["boolean", ["feature-state", "hover"], false],
					opacity * 0.58,
					opacity,
				],
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
				color: ["get", "color"],
				opacity: (opacity) => [
					"case",
					["boolean", ["feature-state", "hover"], false],
					opacity * 0.58,
					opacity,
				],
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
			// Update source data in-place to avoid remove/add flash
			const src = this.map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
			src.setData(geojson as any);
			this.applyVisibility(visibility);
			return;
		}

		// First render: remove any partial state then build from scratch
		this.removeExistingLayers();
		this.addSource(geojson);

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
		themeId: string,
	): void {
		if (!this.map.isStyleLoaded()) return;

		const existing = this.map.getSource(POINT_SOURCE_ID) as
			| maplibregl.GeoJSONSource
			| undefined;
		if (existing) {
			existing.setData(collection as any);
		} else {
			this.map.addSource(POINT_SOURCE_ID, {
				type: "geojson",
				data: collection as any,
			});
			// Heatmap sits underneath so circles draw on top through the fade.
			this.map.addLayer({
				id: HEAT_LAYER_ID,
				type: "heatmap",
				source: POINT_SOURCE_ID,
				paint: {
					// Weight each point by its value (e.g. collision severity).
					"heatmap-weight": [
						"interpolate",
						["linear"],
						["get", "value"],
						1,
						0.4,
						3,
						1,
					],
					"heatmap-intensity": [
						"interpolate",
						["linear"],
						["zoom"],
						4,
						1,
						FADE_MAX_ZOOM,
						2.5,
					],
					"heatmap-radius": [
						"interpolate",
						["linear"],
						["zoom"],
						4,
						15,
						FADE_MAX_ZOOM,
						35,
					],
				},
			});
			this.map.addLayer({
				id: POINT_LAYER_ID,
				type: "circle",
				source: POINT_SOURCE_ID,
				paint: {
					"circle-radius": [
						"interpolate",
						["linear"],
						["zoom"],
						4,
						3,
						10,
						7,
					],
					"circle-color": ["get", "color"],
				},
			});
		}

		const o = visibility.overlayOpacity ?? 0.6;
		const circleMax = visibility.hideDataLayer ? 0 : Math.min(1, o + 0.3);
		const heatMax = visibility.hideDataLayer ? 0 : Math.min(1, o + 0.3);

		// Circles fade in as we zoom past FADE_MIN_ZOOM; the heatmap fades out
		// over the same range, so exactly one representation dominates at a time.
		this.map.setPaintProperty(POINT_LAYER_ID, "circle-opacity", [
			"interpolate",
			["linear"],
			["zoom"],
			FADE_MIN_ZOOM,
			0,
			FADE_MAX_ZOOM,
			circleMax,
		]);
		this.map.setPaintProperty(HEAT_LAYER_ID, "heatmap-opacity", [
			"interpolate",
			["linear"],
			["zoom"],
			FADE_MIN_ZOOM,
			heatMax,
			FADE_MAX_ZOOM,
			0,
		]);
		// Set each call so palette changes propagate to the heatmap ramp.
		this.map.setPaintProperty(
			HEAT_LAYER_ID,
			"heatmap-color",
			buildHeatmapColorRamp(themeId) as any,
		);
	}

	clearPointLayers(): void {
		if (this.map.getLayer(POINT_LAYER_ID))
			this.map.removeLayer(POINT_LAYER_ID);
		if (this.map.getLayer(HEAT_LAYER_ID))
			this.map.removeLayer(HEAT_LAYER_ID);
		if (this.map.getSource(POINT_SOURCE_ID))
			this.map.removeSource(POINT_SOURCE_ID);
	}

	// Blanks the choropleth fill/line without tearing the source down — used when
	// switching to a point dataset so stale boundary data doesn't linger beneath.
	clearBoundaryData(): void {
		const src = this.map.getSource(SOURCE_ID) as
			| maplibregl.GeoJSONSource
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
