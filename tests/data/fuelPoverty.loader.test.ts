import { describe, expect, it } from "vitest";
import { loadFuelPoverty } from "@/lib/data/fuel-poverty/loader";

describe("loadFuelPoverty", () => {
	it("aggregates LSOA rows as they are read from the ODS table", async () => {
		const result = await loadFuelPoverty(async (path, options, visit) => {
			expect(path).toBe("economics/fuel-poverty/fuel-poverty-2024.ods");
			expect(options).toEqual({
				table: "Table_4",
				label: "fuel-poverty",
				maxColumns: 8,
			});
			visit([
				"E01000001",
				"Example LSOA",
				"",
				"",
				"",
				"100",
				"20",
				"0.2",
			]);
		});

		// The 2024 workbook is keyed by the 2021 LSOAs.
		expect(result[2024]?.boundaryYear).toBe(2021);
		expect(result[2024]?.data.E01000001).toEqual({
			lsoaCode: "E01000001",
			lsoaName: "Example LSOA",
			householdCount: 100,
			fuelPoorHouseholdCount: 20,
			fuelPovertyRate: 0.2,
		});
	});
});
