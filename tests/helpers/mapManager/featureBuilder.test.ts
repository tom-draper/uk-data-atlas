import { describe, expect, it } from "vitest";
import { getSequentialColorForValue } from "@/lib/helpers/colorScale/datasetColors";
import { FeatureBuilder } from "@/lib/helpers/mapManager/featureBuilder";
import { boundaryTiles } from "@/lib/data/boundaries/tiles";
import {
	valueGeojson,
	type MapRenderContext,
} from "@/lib/helpers/mapRendering/context";

describe("FeatureBuilder point colours", () => {
	it("samples the active heatmap theme from low to high point values", () => {
		const points = [
			{ lng: -1, lat: 51, value: 1 },
			{ lng: -1, lat: 52, value: 2 },
			{ lng: -1, lat: 53, value: 3 },
		];
		const collection = new FeatureBuilder().buildPointCollection(
			points,
			1,
			3,
			"viridis",
		);

		expect(
			collection.features.map((feature) => feature.properties?.color),
		).toEqual(
			points.map((point) =>
				getSequentialColorForValue(
					point.value,
					{ min: 1, max: 3 },
					"viridis",
				),
			),
		);
	});
});

describe("FeatureBuilder tile values", () => {
	const sidecar = {
		type: "FeatureCollection",
		crs: { type: "name", properties: { name: "" } },
		features: [
			{
				type: "Feature",
				id: 1,
				geometry: null,
				properties: { LSOA21CD: "E01", LSOA21NM: "One", extra: 1 },
			},
			{
				type: "Feature",
				id: 2,
				geometry: null,
				properties: { LSOA21CD: "E02", LSOA21NM: "Two", extra: 2 },
			},
		],
	} as any;
	const values: Record<string, number> = { E01: 5 };

	it("carries only the tile code and the value", () => {
		const features = new FeatureBuilder().buildTileValueFeatures(
			sidecar.features,
			"LSOA21CD" as any,
			"LSOA21CD" as any,
			(code) => values[code],
		);
		expect(features.map((feature) => feature.properties)).toEqual([
			{ LSOA21CD: "E01", value: 5 },
			{ LSOA21CD: "E02", value: null },
		]);
		expect(features.map((feature) => feature.id)).toEqual([1, 2]);
	});

	it("is what valueGeojson builds for a collection drawn from tiles", () => {
		const featureBuilder = new FeatureBuilder();
		const ctx = {
			featureBuilder,
			transformed: (
				_g: unknown,
				_d: unknown,
				_m: string,
				build: () => any,
			) => build(),
		} as unknown as MapRenderContext;
		boundaryTiles.set(sidecar, {
			href: "x.pmtiles",
			minZoom: 0,
			maxZoom: 10,
			codeKey: "LSOA21CD" as any,
			ids: new Map([
				["E01", 0],
				["E02", 1],
			]),
		});
		const geojson = valueGeojson(
			ctx,
			sidecar,
			{},
			"mode",
			"LSOA21CD" as any,
			(code) => values[code],
		);
		expect(geojson.features[0].properties).toEqual({
			LSOA21CD: "E01",
			value: 5,
		});
	});
});
