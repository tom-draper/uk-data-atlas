import { describe, it, expect } from "vitest";
import {
	compactMatchIndexLevel,
	detectCoordinateColumns,
	parseMatchIndexLevel,
} from "@/lib/data/areaBank";

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

describe("match index vintages", () => {
	const level = {
		2023: {
			codes: ["E05000001", "E05000002"],
			names: { alpha: ["E05000001"], beta: ["E05000002"] },
		},
		2024: {
			codes: ["E05000001", "E05000003", "E05000004"],
			names: {
				alpha: ["E05000001", "E05000004"],
				beta: ["E05000003"],
			},
		},
	};

	it("stores a code shared by several vintages once", () => {
		const compact = compactMatchIndexLevel(level);
		expect(Object.keys(compact.codes)).toHaveLength(4);
		expect(compact.names).toHaveLength(4);
	});

	it("expands back to the same codes and names for every vintage", () => {
		const parsed = parseMatchIndexLevel(compactMatchIndexLevel(level));
		expect(Object.keys(parsed).map(Number)).toEqual([2023, 2024]);
		for (const year of [2023, 2024] as const) {
			expect(new Set(parsed[year].codes)).toEqual(
				new Set(level[year].codes),
			);
			expect(parsed[year].names).toEqual(level[year].names);
		}
	});

	it("rejects a mask that names a vintage the level does not have", () => {
		expect(() =>
			parseMatchIndexLevel({
				years: [2024],
				codes: { E05000001: 0b10 },
				names: [],
			}),
		).toThrow();
	});
});
