import { describe, expect, it } from "vitest";
import { loadChildPoverty } from "@/lib/data/child-poverty/loader";

describe("loadChildPoverty", () => {
	it("aggregates rows as they are read from the ODS table", async () => {
		const result = await loadChildPoverty(async (path, options, visit) => {
			expect(path).toBe(
				"economics/child-poverty/children-in-low-income-families-2022-2025.ods",
			);
			expect(options).toEqual({
				table: "7_BHC_Relative_LA",
				label: "child-poverty",
				maxColumns: 10,
			});
			visit([
				"Example authority",
				"E06000001",
				"100",
				"110",
				"120",
				"130",
				"0.1",
				"0.2",
				"0.3",
				"0.4",
			]);
		});

		expect(result[2022]?.data.E06000001).toEqual({
			ladCode: "E06000001",
			ladName: "Example authority",
			childCount: 100,
			childrenPopulation: 1000,
			childPovertyRate: 10,
		});
		expect(result[2025]?.data.E06000001).toEqual({
			ladCode: "E06000001",
			ladName: "Example authority",
			childCount: 130,
			childrenPopulation: 325,
			childPovertyRate: 40,
		});
	});
});
