import { describe, expect, it, vi } from "vitest";
import { getAreaCachedValue } from "@/lib/helpers/demographicData";

describe("getAreaCachedValue", () => {
	it("invalidates entries when the dataset slice or mappings change", () => {
		const cache = new Map<string, Map<number, number>>();
		const dataset = {};
		const compute = vi.fn(() => 10);

		expect(
			getAreaCachedValue(
				cache,
				"constituency-C1",
				2021,
				dataset,
				0,
				compute,
			),
		).toBe(10);
		expect(
			getAreaCachedValue(
				cache,
				"constituency-C1",
				2021,
				dataset,
				0,
				compute,
			),
		).toBe(10);
		expect(compute).toHaveBeenCalledTimes(1);

		getAreaCachedValue(cache, "constituency-C1", 2021, dataset, 1, compute);
		getAreaCachedValue(cache, "constituency-C1", 2021, {}, 1, compute);
		expect(compute).toHaveBeenCalledTimes(3);
	});
});
