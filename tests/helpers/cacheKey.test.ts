import { describe, expect, it } from "vitest";
import { cacheKey } from "@/lib/helpers/cacheKey";

describe("cacheKey", () => {
	it("keeps compound key parts unambiguous", () => {
		expect(cacheKey("ward-a", "dataset", 1)).not.toBe(
			cacheKey("ward", "a-dataset", 1),
		);
	});
});
