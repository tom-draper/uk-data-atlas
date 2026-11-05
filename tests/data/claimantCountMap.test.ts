import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { getChartDatasetDefinition } from "@/lib/datasets";
import type { ClaimantCountDataset } from "@uk-data-atlas/datasets/types/claimantCount";

const dataset: ClaimantCountDataset = {
	id: "claimant-count2026",
	type: "claimant-count",
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
		const valueFor = getChartDatasetDefinition("claimant-count")?.map
			?.valueFor as
			| ((
					dataset: ClaimantCountDataset,
					code: string,
					options: typeof DEFAULT_MAP_OPTIONS,
			  ) => number | null)
			| undefined;
		expect(valueFor?.(dataset, "E1", DEFAULT_MAP_OPTIONS)).toBe(4.5);
		expect(
			valueFor?.(dataset, "E1", {
				...DEFAULT_MAP_OPTIONS,
				"claimant-count": {
					...DEFAULT_MAP_OPTIONS["claimant-count"],
					measure: "count",
				},
			}),
		).toBe(2500);
	});
});
