import { boundaryTiles } from "@/lib/data/boundaries/tiles";
import { describe, expect, it } from "vitest";
import type { BoundaryGeojson, Dataset } from "@/lib/types";
import { prepareActiveDatasetGeometry } from "@/lib/hooks/useActiveDatasetGeometry";

const geometry = {
	type: "FeatureCollection",
	features: [
		{
			type: "Feature",
			properties: { LSOA11CD: "E01000001" },
			geometry: null,
		},
		{
			type: "Feature",
			properties: { LSOA11CD: "W01000001" },
			geometry: null,
		},
		{
			type: "Feature",
			properties: { LSOA11CD: "S01000001" },
			geometry: null,
		},
	],
} as any;

const dataset = {
	id: "upload",
	type: "custom",
	kind: "choropleth",
	name: "Upload",
	year: 2024,
	boundaryType: "lsoa",
	boundaryYear: 2011,
	dataColumn: "value",
	data: { E01000001: 12 },
} as any;

const codesOf = (prepared: typeof geometry) =>
	prepared.features.map(
		(feature: (typeof geometry.features)[number]) =>
			feature.properties.LSOA11CD,
	);

describe("active dataset geometry preparation", () => {
	it("preserves tile source and full-release ids when coverage filters the collection", () => {
		const tiles = {
			href: "/data/boundaries/lsoa/test/boundaries.pmtiles",
			minZoom: 0,
			maxZoom: 12,
			codeKey: "LSOA11CD" as const,
			ids: new Map([
				["E01000001", 1],
				["S01000001", 2],
				["W01000001", 3],
			]),
		};
		boundaryTiles.set(geometry, tiles);
		const prepared = prepareActiveDatasetGeometry(geometry, dataset);
		expect(prepared).not.toBe(geometry);
		expect(prepared && boundaryTiles.get(prepared)).toBe(tiles);
	});

	it("retains GDP boundaries with ITL codes when UK coverage is declared", () => {
		const gdpGeometry = {
			type: "FeatureCollection",
			crs: { type: "name", properties: { name: "EPSG:4326" } },
			features: ["TLC31", "TLL11", "TLM81", "TLN06"].map((code, id) => ({
				type: "Feature" as const,
				id,
				properties: { ITL325CD: code, ITL325NM: code },
				geometry: null,
			})),
		} satisfies BoundaryGeojson;
		const gdpDataset = {
			id: "regionalGdpItl32023",
			type: "regionalGdpItl3",
			year: 2023,
			boundaryType: "itl3",
			boundaryYear: 2025,
			coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
			data: Object.fromEntries(
				gdpGeometry.features.map((feature) => [
					feature.properties.ITL325CD,
					{
						itlCode: feature.properties.ITL325CD,
						itlName: feature.properties.ITL325NM,
						gdpMillionGbp: 100,
						gvaMillionGbp: 90,
					},
				]),
			),
		} satisfies Dataset;

		expect(
			prepareActiveDatasetGeometry(gdpGeometry, gdpDataset)?.features,
		).toEqual(gdpGeometry.features);
	});

	it("filters boundary features to the active dataset's record keys", () => {
		const prepared = prepareActiveDatasetGeometry(geometry, dataset);

		expect(codesOf(prepared as typeof geometry)).toEqual(["E01000001"]);
	});

	it("retains declared coverage when a release has no records", () => {
		const prepared = prepareActiveDatasetGeometry(geometry, {
			...dataset,
			data: {},
			coverageCountries: ["GB-ENG", "GB-WLS"],
		});

		expect(codesOf(prepared as typeof geometry)).toEqual([
			"E01000001",
			"W01000001",
		]);
	});

	it("keeps the empty-map behaviour for datasets without coverage", () => {
		const prepared = prepareActiveDatasetGeometry(geometry, {
			...dataset,
			data: {},
		});

		expect(prepared?.features).toEqual([]);
	});

	it("leaves map-native datasets and absent geometry alone", () => {
		const network = { id: "roads", type: "network" } as any;

		expect(prepareActiveDatasetGeometry(geometry, network)).toBe(geometry);
		expect(prepareActiveDatasetGeometry(null, dataset)).toBeNull();
	});
});
