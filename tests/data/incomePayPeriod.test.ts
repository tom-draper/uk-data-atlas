import { describe, it, expect } from "vitest";
import { incomeDefinition } from "@/lib/datasets/income";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import type { IncomeDataset } from "@uk-data-atlas/datasets/types/income";
describe("pay period", () => {
	it("selects hourly pay and preserves suppressed data", () => {
		const dataset = {
			type: "income",
			data: {
				E1: {
					annual: { median: 30000, mean: 35000 },
					hourly: { median: 15.25, mean: null },
				},
			},
		} as unknown as IncomeDataset;
		const options = {
			...DEFAULT_MAP_OPTIONS,
			income: {
				...DEFAULT_MAP_OPTIONS.income,
				period: "hourly" as const,
			},
		};
		expect(incomeDefinition.map?.valueFor?.(dataset, "E1", options)).toBe(
			15.25,
		);
		expect(
			incomeDefinition.map?.valueFor?.(dataset, "E1", {
				...options,
				income: { ...options.income, measure: "mean" },
			}),
		).toBeNull();
		expect(
			incomeDefinition.map?.valueFor?.(dataset, "missing", options),
		).toBeNull();
		expect(incomeDefinition.map?.legend?.format?.(15.25, options)).toBe(
			"£15.25/hour",
		);
	});
});
