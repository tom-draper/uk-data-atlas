import { describe, expect, it } from "vitest";
import {
	completedBoundaryTypes,
	mergeBoundaryGroups,
} from "@/lib/data/boundaries/loadState";
import type { BoundaryData, BoundaryGeojson } from "@/lib/types";

const boundary = (code: string) =>
	({
		type: "FeatureCollection",
		features: [
			{
				type: "Feature",
				properties: { WD24CD: code },
				geometry: null,
			},
		],
	}) as unknown as BoundaryGeojson;

describe("boundary load state", () => {
	it("keeps partial groups eligible for a future retry", () => {
		expect(
			completedBoundaryTypes([
				["ward", { data: { 2024: boundary("A") }, failures: ["404"] }],
			]),
		).toEqual([]);
	});

	it("merges retry results with previously loaded vintages", () => {
		const previous = {
			ward: { 2024: boundary("A"), 2025: null },
		} as unknown as BoundaryData;
		const result = mergeBoundaryGroups(previous, [
			["ward", { data: { 2025: boundary("B") }, failures: [] }],
		]);

		expect(result.ward[2024]?.features[0]?.properties).toMatchObject({
			WD24CD: "A",
		});
		expect(result.ward[2025]?.features[0]?.properties).toMatchObject({
			WD24CD: "B",
		});
	});
});
