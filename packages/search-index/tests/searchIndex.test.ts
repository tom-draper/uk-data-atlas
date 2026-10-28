import { describe, expect, it } from "vitest";
import {
	atEach,
	compareCodeUnits,
	findNumber,
	findSorted,
	lowerBound,
	packPositions,
} from "@uk-data-atlas/search-index";

describe("compiled search indexes", () => {
	it("searches strings in the order used by the compiler", () => {
		const values = ["é", "a2", "a10", "A"].sort(compareCodeUnits);
		expect(values).toEqual(["A", "a10", "a2", "é"]);
		expect(lowerBound(values, "a1")).toBe(1);
		expect(findSorted(values, "a2")).toBe(2);
		expect(findSorted(values, "missing")).toBe(-1);
		expect(findNumber([1, 4, 8], 4)).toBe(1);
		expect(findNumber([1, 4, 8], 3)).toBe(-1);
	});

	it("reads positions in batches and packs them as little-endian integers", () => {
		expect(atEach(["a", "b", "c"], [2, 0, 5])).toEqual([
			"c",
			"a",
			undefined,
		]);
		expect(Array.from(packPositions([1, 256, 65536]))).toEqual([
			1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,
		]);
	});
});
