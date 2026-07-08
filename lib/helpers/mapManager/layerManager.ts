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
import { DEFAULT_COLOR } from "./featureBuilder";

const SOURCE_ID = "location-wards";
const FILL_LAYER_ID = "wards-fill";
const LINE_LAYER_ID = "wards-line";
const POINT_SOURCE_ID = "custom-points";
const POINT_LAYER_ID = "custom-points-circle";
const HEAT_LAYER_ID = "custom-points-heat";

// Cross-fade between the heatmap (zoomed out, where individual points overlap
// into noise) and discrete circles (zoomed in, where each point is meaningful).
const FADE_MIN_ZOOM = 7;
const FADE_MAX_ZOOM = 10;

const EMPTY_FC = { type: "FeatureCollection", features: [] } as const;

type FillPaintConfig = {
	color: any;
	opacity: number | any[];
};

export class LayerManager {
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

		const o = visibility.overlayOpacity ?? 0.6;
		this.updateLayers(
			geojson,
			{
				color: colorExpression,
				opacity: [
					"case",
					["boolean", ["feature-state", "hover"], false],
					o * 0.58,
					o,
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
				opacity: visibility.overlayOpacity ?? 0.6,
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

		const o = visibility.overlayOpacity ?? 0.6;
		this.updateLayers(
			geojson,
			{
				color: colorExpression,
				opacity: [
					"case",
					["boolean", ["feature-state", "hover"], false],
					o * 0.58,
					o,
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
				opacity: visibility.overlayOpacity ?? 0.6,
			},
			visibility,
		);
	}

	updateColoredLayers(
		geojson: BoundaryGeojson,
		visibility: MapOptions["visibility"],
	): void {
		const o = visibility.overlayOpacity ?? 0.6;
		this.updateLayers(
			geojson,
			{
				color: ["get", "color"],
				opacity: [
					"case",
					["boolean", ["feature-state", "hover"], false],
					o * 0.58,
					o,
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
		const styleLoaded = this.map.isStyleLoaded();
		const sourceExists = !!this.map.getSource(SOURCE_ID);
		const fillLayerExists = !!this.map.getLayer(FILL_LAYER_ID);
		const lineLayerExists = !!this.map.getLayer(LINE_LAYER_ID);
		if (!styleLoaded) return;

		const overlayOpacity = visibility.overlayOpacity ?? 0.6;

		let fillColor: any;
		let fillOpacity: any;
		let lineColor: string;
		let lineOpacity: any;

		if (visibility.hideBoundaryLayer) {
			fillColor = "transparent";
			fillOpacity = 0;
			lineColor = "transparent";
			lineOpacity = 0;
		} else if (visibility.hideDataLayer) {
			fillColor = DEFAULT_COLOR;
			fillOpacity = overlayOpacity;
			lineColor = "#000";
			lineOpacity = visibility.hideBorders ? 0 : 0.05;
		} else {
			fillColor = paint.color;
			fillOpacity = paint.opacity;
			lineColor = "#000";
			lineOpacity = visibility.hideBorders ? 0 : 0.05;
		}

		if (sourceExists && fillLayerExists && lineLayerExists) {
			// Update source data in-place to avoid remove/add flash
			const src = this.map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
			src.setData(geojson as any);
			this.map.setPaintProperty(FILL_LAYER_ID, "fill-color", fillColor);
			this.map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", fillOpacity);
			this.map.setPaintProperty(LINE_LAYER_ID, "line-color", lineColor);
			this.map.setPaintProperty(LINE_LAYER_ID, "line-opacity", lineOpacity);
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
				"fill-color": fillColor,
				"fill-opacity": fillOpacity,
			},
		});

		this.map.addLayer({
			id: LINE_LAYER_ID,
			type: "line",
			source: SOURCE_ID,
			paint: {
				"line-color": lineColor,
				"line-width": 1,
				"line-opacity": lineOpacity as any,
			},
		});
	}

	// --- Custom point datasets (coordinates / postcodes) ---

	updatePointLayers(
		collection: GeoJSON.FeatureCollection,
		visibility: MapOptions["visibility"],
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
						0.6,
						FADE_MAX_ZOOM,
						1.2,
					],
					"heatmap-radius": [
						"interpolate",
						["linear"],
						["zoom"],
						4,
						6,
						FADE_MAX_ZOOM,
						18,
					],
					"heatmap-color": [
						"interpolate",
						["linear"],
						["heatmap-density"],
						0,
						"rgba(33,102,172,0)",
						0.2,
						"rgba(103,169,207,0.6)",
						0.4,
						"rgb(209,229,240)",
						0.6,
						"rgb(253,219,199)",
						0.8,
						"rgb(239,138,98)",
						1,
						"rgb(178,24,43)",
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
					"circle-stroke-color": "#ffffff",
					"circle-stroke-width": 1,
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
		this.map.setPaintProperty(POINT_LAYER_ID, "circle-stroke-opacity", [
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
