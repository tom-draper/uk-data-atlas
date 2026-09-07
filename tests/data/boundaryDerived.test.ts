import { describe, expect, it } from "vitest";
import { featureAreaSqKm, featureExtent } from "@/lib/data/boundaries/derived";
import { polygonAreaSqKm } from "@/lib/helpers/population";
import type { Feature } from "@/lib/types";

// A square degree off the south coast, big enough that the area is well clear
// of rounding and small enough to stay a simple ring.
const square = [
	[-1, 50],
	[0, 50],
	[0, 51],
	[-1, 51],
	[-1, 50],
];

const makeFeature = (
	properties: Record<string, unknown>,
	withGeometry = true,
): Feature =>
	({
		type: "Feature",
		id: 1,
		properties,
		geometry: withGeometry
			? { type: "Polygon", coordinates: [square] }
			: null,
	}) as unknown as Feature;

describe("featureAreaSqKm", () => {
	it("prefers the compiled area over walking the geometry", () => {
		const feature = makeFeature({ areaSqKm: 42 });
		expect(featureAreaSqKm(feature)).toBe(42);
	});

	it("falls back to the geometry, matching the direct computation", () => {
		const feature = makeFeature({});
		expect(featureAreaSqKm(feature)).toBeCloseTo(
			polygonAreaSqKm(feature.geometry!),
			9,
		);
	});

	it("reports zero when a properties-only feature carries no area", () => {
		expect(featureAreaSqKm(makeFeature({}, false))).toBe(0);
	});

	it("ignores a non-finite compiled area", () => {
		const feature = makeFeature({ areaSqKm: Number.NaN });
		expect(featureAreaSqKm(feature)).toBeCloseTo(
			polygonAreaSqKm(feature.geometry!),
			9,
		);
	});
});

describe("featureExtent", () => {
	it("prefers the compiled extent", () => {
		expect(featureExtent(makeFeature({ bbox: [1, 2, 3, 4] }))).toEqual([
			1, 2, 3, 4,
		]);
	});

	it("falls back to walking the geometry", () => {
		expect(featureExtent(makeFeature({}))).toEqual([-1, 50, 0, 51]);
	});

	it("returns null when there is neither an extent nor a geometry", () => {
		expect(featureExtent(makeFeature({}, false))).toBeNull();
	});

	it("ignores a malformed compiled extent", () => {
		expect(featureExtent(makeFeature({ bbox: [1, 2, 3] }))).toEqual([
			-1, 50, 0, 51,
		]);
	});
});
