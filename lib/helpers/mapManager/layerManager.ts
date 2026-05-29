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
		if (!this.map.isStyleLoaded()) return;

		const overlayOpacity = visibility.overlayOpacity ?? 0.6;

		let fillColor: any;
		let fillOpacity: any;
		let lineColor: string;
		let lineOpacity: number;

		if (visibility.hideDataLayer) {
			fillColor = DEFAULT_COLOR;
			fillOpacity = overlayOpacity;
			lineColor = DEFAULT_COLOR;
			lineOpacity = visibility.showBorders ? 0.6 * overlayOpacity : 0;
		} else {
			fillColor = paint.color;
			fillOpacity = paint.opacity;
			lineColor = "#000";
			lineOpacity = visibility.showBorders ? 0.05 : 0;
		}

		const sourceExists = !!this.map.getSource(SOURCE_ID);
		const fillLayerExists = !!this.map.getLayer(FILL_LAYER_ID);
		const lineLayerExists = !!this.map.getLayer(LINE_LAYER_ID);

		if (sourceExists && fillLayerExists && lineLayerExists) {
			// Update source data in-place to avoid remove/add flash
			(this.map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson as any);
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
