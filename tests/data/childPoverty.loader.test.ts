import { describe, expect, it } from "vitest";
import {
	childPovertyStatisticsParts,
	sourceDir,
} from "@uk-data-atlas/datasets";

describe("childPovertyStatisticsParts", () => {
	it("aggregates rows as they are read from the ODS table", async () => {
		const parts = await childPovertyStatisticsParts(
			async (path, options, visit) => {
				expect(path).toBe(
					sourceDir(
						"child-poverty",
						"children-in-low-income-families-2022-2025.ods",
					),
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
			},
		);

		const values = (key: string) =>
			parts
				.find((part) => part.key === key)
				?.records.find((record) => record.code === "E06000001")?.values;

		expect(parts.map((part) => part.key)).toEqual([
			"2022",
			"2023",
			"2024",
			"2025",
		]);
		expect(values("2022")).toEqual([
			{ measure: "children-in-relative-low-income", value: 100 },
			{ measure: "children-in-relative-low-income-rate", value: 10 },
		]);
		expect(values("2025")).toEqual([
			{ measure: "children-in-relative-low-income", value: 130 },
			{ measure: "children-in-relative-low-income-rate", value: 40 },
		]);
	});
});
