import { describe, it, expect } from "vitest";
import { detectCoordinateColumns } from "@/lib/data/areaBank";

describe("detectCoordinateColumns", () => {
	it("detects lat/lng by header name regardless of column order", () => {
		const table = [
			["name", "Longitude", "Latitude", "value"],
			["London", "-0.1278", "51.5074", "10"],
			["Manchester", "-2.2426", "53.4808", "20"],
		];
		expect(detectCoordinateColumns(table, 0)).toEqual({
			latIdx: 2,
			lngIdx: 1,
		});
	});

	it("uses a wide-range column as longitude when headers are unhelpful", () => {
		const table = [
			["a", "b", "label"],
			["51.5", "-120.4", "x"], // b spans beyond ±90 → longitude
			["53.4", "100.2", "y"],
		];
		expect(detectCoordinateColumns(table, 0)).toEqual({
			latIdx: 0,
			lngIdx: 1,
		});
	});

	it("falls back to CSV order (lat, lng) for ambiguous UK-range columns", () => {
		const table = [
			["c1", "c2", "v"],
			["51.5074", "-0.1278", "1"],
			["53.4808", "-2.2426", "2"],
		];
		expect(detectCoordinateColumns(table, 0)).toEqual({
			latIdx: 0,
			lngIdx: 1,
		});
	});

	it("returns null when there is no decimal coordinate pair", () => {
		const table = [
			["code", "value"],
			["E05000001", "10"],
			["E05000002", "20"],
		];
		expect(detectCoordinateColumns(table, 0)).toBeNull();
	});
});
