import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { incomeDefinition } from "@/lib/datasets/income";
import type { IncomeDataset } from "@/lib/types/income";

const dataset: IncomeDataset = {
	id: "income2025",
	type: "income",
	year: 2025,
	boundaryYear: 2025,
	boundaryType: "localAuthority",
	data: {
		E1: {
			ladCode: "E1",
			ladName: "Example",
			annual: {
				numberOfJobs: null,
				median: 30000,
				medianPercentageChange: null,
				mean: 36000,
				meanPercentageChange: null,
				percentiles: {
					p10: null,
					p20: null,
					p25: null,
					p30: null,
					p40: null,
					p60: null,
					p70: null,
					p75: null,
					p80: null,
					p90: null,
				},
			},
			hourly: null,
		},
	},
};

describe("income map metric", () => {
	it("uses the selected annual median or mean income", () => {
		const valueFor = incomeDefinition.map?.valueFor;
		expect(valueFor?.(dataset, "E1", DEFAULT_MAP_OPTIONS)).toBe(30000);

		expect(
			valueFor?.(dataset, "E1", {
				...DEFAULT_MAP_OPTIONS,
				income: {
					...DEFAULT_MAP_OPTIONS.income,
					measure: "mean",
				},
			}),
		).toBe(36000);
	});
});
