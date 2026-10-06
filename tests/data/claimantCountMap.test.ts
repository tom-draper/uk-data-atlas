import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { claimantCountDefinition } from "@/lib/datasets/claimantCount";
import type { ClaimantCountDataset } from "@/lib/types/claimantCount";

const dataset: ClaimantCountDataset = {
	id: "claimantCount2026",
	type: "claimantCount",
	year: 2026,
	month: "Apr 2026",
	boundaryType: "localAuthority",
	boundaryYear: 2024,
	data: {
		E1: {
			ladCode: "E1",
			ladName: "Example",
			totalCount: 2500,
			totalRate: 4.5,
			youthCount: 500,
			youthRate: 0.9,
		},
	},
};

describe("claimant count map metric", () => {
	it("uses the selected rate or count", () => {
		const valueFor = claimantCountDefinition.map?.valueFor;
		expect(valueFor?.(dataset, "E1", DEFAULT_MAP_OPTIONS)).toBe(4.5);
		expect(
			valueFor?.(dataset, "E1", {
				...DEFAULT_MAP_OPTIONS,
				claimantCount: {
					...DEFAULT_MAP_OPTIONS.claimantCount,
					measure: "count",
				},
			}),
		).toBe(2500);
	});
});
