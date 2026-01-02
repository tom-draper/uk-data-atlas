// lib/utils/mapManager/layerManager.ts
import { BoundaryGeojson, Party, PartyCode } from "@lib/types";
import {
	LocalElectionOptions,
	GeneralElectionOptions,
	MapOptions,
	EthnicityOptions,
} from "@lib/types/mapOptions";
import { PARTIES } from "@/lib/data/election/parties";
import { ETHNICITY_COLORS, getPercentageColorExpression } from "../colorScale";

const SOURCE_ID = "location-wards";
const FILL_LAYER_ID = "wards-fill";
const LINE_LAYER_ID = "wards-line";

type FillPaintConfig = {
	color: any;
	opacity: number | any[];
};

export class LayerManager {
	constructor(private map: mapboxgl.Map | maplibregl.Map) {}

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
				opacity: [
					"case",
					["boolean", ["feature-state", "hover"], false],
					0.35,
					0.6,
				],
			},
			visibility,
		);
	}

	updatePartyPercentageLayers(
		geojson: BoundaryGeojson,
		options: LocalElectionOptions | GeneralElectionOptions,
		visibility: MapOptions["visibility"],
	): void {
		if (!options.selected) return;
		const baseColor = PARTIES[options.selected as PartyCode]?.color || "#999999";
		const fillColorExpression = getPercentageColorExpression(
			baseColor,
			options,
		);

		this.updateLayers(
			geojson,
			{
				color: fillColorExpression,
				opacity: 0.7,
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
				opacity: [
					"case",
					["boolean", ["feature-state", "hover"], false],
					0.35,
					0.6,
				],
			},
			visibility,
		);
	}

	updateEthnicityCategoryPercentageLayers(
		geojson: BoundaryGeojson,
		options: EthnicityOptions,
		visibility: MapOptions["visibility"],
	): void {
		if (!options.selected) return;
		const baseColor = ETHNICITY_COLORS[options.selected];

		const fillColorExpression = getPercentageColorExpression(
			baseColor,
			options,
		);

		this.updateLayers(
			geojson,
			{
				color: fillColorExpression,
				opacity: 0.7,
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
				opacity: [
					"case",
					["boolean", ["feature-state", "hover"], false],
					0.35,
					0.6,
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
		this.removeExistingLayers();
		this.addSource(geojson);

		const shouldHideData =
			visibility.hideDataLayer || visibility.hideBoundaries;

		this.map.addLayer({
			id: FILL_LAYER_ID,
			type: "fill",
			source: SOURCE_ID,
			paint: {
				"fill-color": shouldHideData ? "transparent" : paint.color,
				"fill-opacity": shouldHideData ? 0 : paint.opacity as any,
			},
		});

		this.addBorderLayer();
	}

	private addBorderLayer(): void {
		this.map.addLayer({
			id: LINE_LAYER_ID,
			type: "line",
			source: SOURCE_ID,
			paint: {
				"line-color": "#000",
				"line-width": 1,
				"line-opacity": 0.05,
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
