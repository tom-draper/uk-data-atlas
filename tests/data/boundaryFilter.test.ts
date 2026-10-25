import { describe, expect, it } from "vitest";
import { filterFeatures } from "@/lib/data/boundaries/boundaries";
import { gazetteer } from "@/lib/data/gazetteer/static";
import type { BoundaryGeojson } from "@/lib/types";

describe("properties-only boundary filtering", () => {
	it("filters pupil absence boundaries to the selected location", () => {
		const boundaries = {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					properties: {
						CTYUA25CD: "E08000003",
						bbox: gazetteer.boundsOf("Greater Manchester"),
					},
					geometry: null,
				},
				{
					type: "Feature",
					properties: {
						CTYUA25CD: "E10000020",
						bbox: [0.5, 52.5, 1.5, 53],
					},
					geometry: null,
				},
			],
		} as unknown as BoundaryGeojson;
		expect(
			filterFeatures(boundaries, {
				location: "Greater Manchester",
				type: "countyAndUnitaryAuthority",
			}).features,
		).toEqual([boundaries.features[0]]);
		expect(
			filterFeatures(boundaries, {
				location: "United Kingdom",
				type: "countyAndUnitaryAuthority",
			}),
		).toBe(boundaries);
	});

	it.each([
		["England", "TLC31"],
		["Wales", "TLL11"],
		["Scotland", "TLM81"],
		["Northern Ireland", "TLN06"],
	])("keeps ITL boundaries in %s", (location, expectedCode) => {
		const boundaries = {
			type: "FeatureCollection",
			crs: { type: "name", properties: { name: "EPSG:4326" } },
			features: ["TLC31", "TLL11", "TLM81", "TLN06"].map((code, id) => ({
				type: "Feature" as const,
				id,
				properties: { ITL325CD: code, ITL325NM: code },
				geometry: null,
			})),
		} satisfies BoundaryGeojson;
		const filtered = filterFeatures(boundaries, { location, type: "itl3" });
		expect(filtered.features).toHaveLength(1);
		expect(filtered.features[0]?.properties).toMatchObject({
			ITL325CD: expectedCode,
		});
	});

	it.each(["itl1", "itl2", "itl3"] as const)(
		"filters %s GDP boundaries to Greater Manchester using council membership",
		(type) => {
			const bbox = gazetteer.namedLocation("Greater Manchester")!.bbox;
			const codeKey = `${type.toUpperCase()}25CD`;
			const boundaries = {
				type: "FeatureCollection",
				features: [
					{
						type: "Feature",
						properties: {
							[codeKey]:
								type === "itl1"
									? "TLD"
									: type === "itl2"
										? "TLD3"
										: "TLD33",
							bbox,
						},
						geometry: null,
					},
					{
						type: "Feature",
						properties: {
							[codeKey]:
								type === "itl1"
									? "TLC"
									: type === "itl2"
										? "TLC3"
										: "TLC31",
							bbox: [0, 0, 1, 1],
						},
						geometry: null,
					},
				],
			} as unknown as BoundaryGeojson;

			expect(
				filterFeatures(boundaries, {
					location: "Greater Manchester",
					type,
				}).features,
			).toEqual([boundaries.features[0]]);
			expect(
				filterFeatures(boundaries, {
					location: "United Kingdom",
					type,
				}),
			).toBe(boundaries);
		},
	);

	it("keeps North West GDP records without requiring compiled extents", () => {
		const boundaries = {
			type: "FeatureCollection",
			features: ["TLD33", "TLD34", "TLC31"].map((code) => ({
				type: "Feature",
				properties: { ITL325CD: code },
				geometry: null,
			})),
		} as unknown as BoundaryGeojson;
		expect(
			filterFeatures(boundaries, { location: "North West", type: "itl3" })
				.features,
		).toEqual(boundaries.features.slice(0, 2));
	});

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
			const filtered = filterFeatures(boundaries, {
				location,
				type: "localAuthority",
			});
			expect(filtered.features).toHaveLength(1);
			expect(filtered.features[0]?.properties).toMatchObject({
				LAD24CD: code,
			});
		}
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

		const filtered = filterFeatures(boundaries, {
			location: "Greater Manchester",
			type: "constituency",
		});

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

		const filtered = filterFeatures(boundaries, {
			location: "Northern Ireland",
			type: "superOutputArea",
		});

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

		const filtered = filterFeatures(boundaries, {
			location: "Greater Manchester",
			type: "constituency",
			relations: {
				constituencyLadOverlaps: {
					E14000001: [
						{ code: greaterManchester!.memberCodes[0]!, weight: 1 },
					],
					E14000002: [],
				},
			},
		});

		expect(filtered.features).toHaveLength(1);
		expect(filtered.features[0]?.properties).toMatchObject({
			PCON24CD: "E14000001",
		});
	});

	it("keeps LSOA geometry by its local-authority membership", () => {
		const greaterManchester = gazetteer.namedLocation("Greater Manchester");
		expect(greaterManchester?.memberCodes).toBeDefined();

		const boundaries = {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					properties: { LSOA11CD: "E01000001" },
					geometry: null,
				},
				{
					type: "Feature",
					properties: { LSOA11CD: "E01000002" },
					geometry: null,
				},
			],
		} as unknown as BoundaryGeojson;

		const filtered = filterFeatures(boundaries, {
			location: "Greater Manchester",
			type: "lsoa",
			relations: {
				lsoaToLad: {
					E01000001: greaterManchester!.memberCodes[0]!,
					E01000002: "E06000001",
				},
			},
		});

		expect(filtered.features).toHaveLength(1);
		expect(filtered.features[0]?.properties).toMatchObject({
			LSOA11CD: "E01000001",
		});
	});
});
