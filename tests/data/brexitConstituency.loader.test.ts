import { describe, expect, it } from "vitest";
import { loadBrexitConstituency } from "@/lib/data/brexit-constituency/loader";

describe("loadBrexitConstituency", () => {
	it("keeps England and Wales, while excluding Scotland and Northern Ireland", async () => {
		const dataset = await loadBrexitConstituency(async () =>
			[
				",E14000001,English seat,,yes,,48.5",
				",W07000041,Welsh seat,,no,,52.5",
				",S14000001,Scottish seat,,yes,,55.5",
				",N06000001,Northern Irish seat,,yes,,44.5",
			].join("\n"),
		);

		expect(Object.keys(dataset[2016].data)).toEqual([
			"E14000001",
			"W07000041",
		]);
		expect(dataset[2016].results.W07000041).toBe("leave");
	});
});
