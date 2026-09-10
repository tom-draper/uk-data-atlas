import { describe, expect, it } from "vitest";
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
