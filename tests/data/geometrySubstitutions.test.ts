import type { FeatureCollection } from "geojson";
import { describe, expect, it } from "vitest";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/catalog";
import {
	GEOMETRY_SUBSTITUTIONS,
	KNOWN_GEOMETRY_DISPLACEMENTS,
	substituteFeatures,
} from "@/lib/data/boundaries/geometrySubstitutions";

const point = (code: string, key: string, x: number): FeatureCollection => ({
	type: "FeatureCollection",
	features: [
		{
			type: "Feature",
			properties: { [key]: code },
			geometry: { type: "Point", coordinates: [x, 54] },
		},
	],
});

const collection = (
	key: string,
	areas: Array<[string, number]>,
): FeatureCollection => ({
	type: "FeatureCollection",
	features: areas.flatMap(([code, x]) => point(code, key, x).features),
});

const substitution = { id: "test", codePrefix: "N" };

describe("substituteFeatures", () => {
	it("replaces covered areas by code and keeps the rest", () => {
		const result = substituteFeatures(
			collection("pcon19cd", [
				["E14000530", -1.5],
				["N06000001", -5.8],
			]),
			"pcon19cd",
			collection("pcon16cd", [["N06000001", -5.9]]),
			"pcon16cd",
			substitution,
			"test",
		);
		expect(
			result.features.map((feature) => [
				feature.properties?.pcon19cd,
				(feature.geometry as { coordinates: number[] }).coordinates[0],
			]),
		).toEqual([
			["E14000530", -1.5],
			["N06000001", -5.9],
		]);
	});

	it("refuses releases that do not hold the same covered codes", () => {
		expect(() =>
			substituteFeatures(
				collection("a", [["N06000001", 0]]),
				"a",
				collection("b", [
					["N06000001", 0],
					["N06000002", 0],
				]),
				"b",
				substitution,
				"test",
			),
		).toThrow("unmatched: N06000002");
	});

	it("refuses a target that repeats a covered code", () => {
		expect(() =>
			substituteFeatures(
				collection("a", [
					["N06000001", 0],
					["N06000001", 1],
				]),
				"a",
				collection("b", [["N06000001", 0]]),
				"b",
				substitution,
				"test",
			),
		).toThrow("repeats a code");
	});
});

describe("geometry substitution definitions", () => {
	const served = (geography: string, release: string) =>
		BOUNDARY_CATALOG[
			geography as keyof typeof BOUNDARY_CATALOG
		]?.releases.some(({ id }) => id === release) ?? false;

	it("name releases the catalogue serves", () => {
		for (const { geography, releases, donor } of GEOMETRY_SUBSTITUTIONS) {
			for (const release of releases)
				expect(served(geography, release), release).toBe(true);
			expect(served(donor.geography, donor.boundaryRelease)).toBe(true);
			expect(releases).not.toContain(donor.boundaryRelease);
		}
		for (const {
			geography,
			boundaryRelease,
		} of KNOWN_GEOMETRY_DISPLACEMENTS)
			expect(served(geography, boundaryRelease), boundaryRelease).toBe(
				true,
			);
	});
});
