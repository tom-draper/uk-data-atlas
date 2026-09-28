import {
	calculateTotal,
	calculateMedianAge,
	polygonAreaSqKm,
} from "@/lib/helpers/population";
import type { PopulationWardData } from "@/lib/types";
import type { BoundaryGeometry } from "@lib/types";

describe("calculateTotal", () => {
	it("sums all age counts", () => {
		expect(calculateTotal({ "0": 100, "1": 200, "2": 300 })).toBe(600);
	});
	it("returns 0 for empty data", () => {
		expect(calculateTotal({})).toBe(0);
	});
	it("handles single age", () => {
		expect(calculateTotal({ "30": 500 })).toBe(500);
	});
});

describe("calculateMedianAge", () => {
	it("returns null for missing ward data", () => {
		expect(calculateMedianAge(null as any)).toBeNull();
		expect(calculateMedianAge({ total: null } as any)).toBeNull();
	});
	it("returns 0 when all population is age 0", () => {
		const ward = { total: { "0": 1000 } } as unknown as PopulationWardData;
		expect(calculateMedianAge(ward)).toBe(0);
	});
	it("returns correct median for uniform distribution", () => {
		// Equal counts at age 20 and 40 → median should be 20 (first age hitting 50%)
		const ward = {
			total: { "20": 100, "40": 100 },
		} as unknown as PopulationWardData;
		expect(calculateMedianAge(ward)).toBe(20);
	});
	it("returns 90 when all population is at age 90+", () => {
		const ward = { total: { "90": 1000 } } as unknown as PopulationWardData;
		expect(calculateMedianAge(ward)).toBe(90);
	});
});

describe("polygonAreaSqKm", () => {
	// A small closed square near London (lat ~51.5, lon ~0.0)
	// Sides roughly 0.01° each — real area is small but non-zero
	const squareRing = [
		[0.0, 51.5],
		[0.01, 51.5],
		[0.01, 51.51],
		[0.0, 51.51],
		[0.0, 51.5],
	];

	const polygon: BoundaryGeometry = {
		type: "Polygon",
		coordinates: [squareRing],
	};

	it("returns a positive area for a valid polygon", () => {
		expect(polygonAreaSqKm(polygon)).toBeGreaterThan(0);
	});
	it("returns 0 for a degenerate ring with fewer than 4 points", () => {
		const area = polygonAreaSqKm({
			type: "Polygon",
			coordinates: [
				[
					[0, 0],
					[1, 0],
					[0, 0],
				],
			],
		});
		expect(area).toBe(0);
	});
	it("handles MultiPolygon by summing constituent areas", () => {
		const singleArea = polygonAreaSqKm(polygon);
		// Two identical polygons side by side as a MultiPolygon
		const multiArea = polygonAreaSqKm({
			type: "MultiPolygon",
			coordinates: [[squareRing], [squareRing]],
		});
		expect(multiArea).toBeCloseTo(singleArea * 2, 5);
	});
	it("area is reasonable for a ~1km² ward-sized polygon", () => {
		// 0.01° lat/lon near London ≈ ~0.7 km²
		const area = polygonAreaSqKm(polygon);
		expect(area).toBeGreaterThan(0.1);
		expect(area).toBeLessThan(5);
	});
});

describe("polygonAreaSqKm edge cases", () => {
	it("reports no area for a geometry with no rings", () => {
		expect(polygonAreaSqKm({ type: "Polygon", coordinates: [] })).toBe(0);
		expect(polygonAreaSqKm({ type: "MultiPolygon", coordinates: [] })).toBe(
			0,
		);
	});
});
