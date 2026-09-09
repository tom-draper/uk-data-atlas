import { describe, expect, it } from "vitest";
import {
	filterFeatures,
	geometryCacheKey,
} from "@/lib/data/boundaries/boundaries";
import { gazetteer } from "@/lib/data/gazetteer/static";
import type { BoundaryGeojson } from "@/lib/types";

describe("properties-only boundary filtering", () => {
	it("keeps current unitary authorities in their historic county scopes", () => {
		const boundaries = {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					properties: { LAD24CD: "E06000066" }, // Somerset
					geometry: null,
				},
				{
					type: "Feature",
					properties: { LAD24CD: "E06000065" }, // North Yorkshire
					geometry: null,
				},
			],
		} as unknown as BoundaryGeojson;

		for (const [location, code] of [
			["Somerset", "E06000066"],
			["North Yorkshire", "E06000065"],
		] as const) {
			const filtered = filterFeatures(
				boundaries,
				location,
				"localAuthority",
			);
			expect(filtered.features).toHaveLength(1);
			expect(filtered.features[0]?.properties).toMatchObject({
				LAD24CD: code,
			});
		}
	});

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

	it("falls through to bbox filtering for a country whose codes don't carry its GSS prefix", () => {
		// Northern Ireland's super output area codes (e.g. "95AA01S1") don't
		// start with "N" like every other NI geography, so selecting the
		// country must not use the letter-prefix fast path for this type.
		const northernIreland = gazetteer.namedLocation("Northern Ireland");
		expect(northernIreland?.bbox).toBeDefined();

		const boundaries = {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					properties: {
						SOA_CODE: "95AA01S1",
						bbox: northernIreland!.bbox,
					},
					geometry: null,
				},
				{
					type: "Feature",
					properties: {
						SOA_CODE: "95AA01S2",
						bbox: [0, 0, 1, 1],
					},
					geometry: null,
				},
			],
		} as unknown as BoundaryGeojson;

		const filtered = filterFeatures(
			boundaries,
			"Northern Ireland",
			"superOutputArea",
		);

		expect(filtered.features).toHaveLength(1);
		expect(filtered.features[0]?.properties).toMatchObject({
			SOA_CODE: "95AA01S1",
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
