import { describe, expect, it } from "vitest";
import { extractWardCodes } from "@/lib/data/boundaries/wardCodes";
import type { BoundaryData } from "@/lib/types";

const wardData = {
	type: "FeatureCollection" as const,
	crs: { type: "name" as const, properties: { name: "CRS84" } },
	features: [
		{
			type: "Feature" as const,
			properties: { WD24CD: "W1" },
			geometry: null,
		},
		{
			type: "Feature" as const,
			properties: { WD24CD: "W2" },
			geometry: null,
		},
	],
} as any;

describe("ward code index", () => {
	it("uses the release schema to extract codes only after loading", () => {
		const data = { ward: { 2024: wardData } } as unknown as BoundaryData;

		expect(extractWardCodes(data, true)).toBeNull();
		expect(extractWardCodes(data, false)).toEqual({
			2024: new Set(["W1", "W2"]),
		});
	});
});
