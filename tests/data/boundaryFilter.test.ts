import { describe, expect, it } from "vitest";
import {
	filterFeatures,
	geometryCacheKey,
} from "@/lib/data/boundaries/boundaries";
import { gazetteer } from "@/lib/data/gazetteer/static";
import type { BoundaryGeojson } from "@/lib/types";

describe("properties-only boundary filtering", () => {
	it("keeps location-filtered geometry in a distinct cache entry", () => {
		const path = "/data/boundaries/ward/2024.topojson";
		const greaterManchester = geometryCacheKey(path, {
			type: "ward",
			location: "Greater Manchester",
		});
		const westMidlands = geometryCacheKey(path, {
			type: "ward",
			location: "West Midlands",
		});

		expect(greaterManchester).not.toBe(path);
		expect(greaterManchester).not.toBe(westMidlands);
	});

	it("uses a compiled bbox to retain an overlapping constituency", () => {
		const greaterManchester = gazetteer.namedLocation("Greater Manchester");
		expect(greaterManchester?.bbox).toBeDefined();

		const boundaries = {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					properties: {
						PCON24CD: "E14000001",
						bbox: greaterManchester!.bbox,
					},
					geometry: null,
				},
				{
					type: "Feature",
					properties: {
						PCON24CD: "E14000002",
						bbox: [0, 0, 1, 1],
					},
					geometry: null,
				},
			],
		} as unknown as BoundaryGeojson;

		const filtered = filterFeatures(
			boundaries,
			"Greater Manchester",
			"constituency",
		);

		expect(filtered.features).toHaveLength(1);
		expect(filtered.features[0]?.properties).toMatchObject({
			PCON24CD: "E14000001",
		});
	});

	it("prefers constituency-to-LAD overlaps over the coarse bbox fallback", () => {
		const greaterManchester = gazetteer.namedLocation("Greater Manchester");
		expect(greaterManchester?.memberCodes).toBeDefined();

		const boundaries = {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					properties: {
						PCON24CD: "E14000001",
						bbox: [0, 0, 1, 1],
					},
					geometry: null,
				},
				{
					type: "Feature",
					properties: {
						PCON24CD: "E14000002",
						bbox: greaterManchester!.bbox,
					},
					geometry: null,
				},
			],
		} as unknown as BoundaryGeojson;

		const filtered = filterFeatures(
			boundaries,
			"Greater Manchester",
			"constituency",
			undefined,
			{
				E14000001: [
					{ code: greaterManchester!.memberCodes[0]!, weight: 1 },
				],
				E14000002: [],
			},
		);

		expect(filtered.features).toHaveLength(1);
		expect(filtered.features[0]?.properties).toMatchObject({
			PCON24CD: "E14000001",
		});
	});
});
