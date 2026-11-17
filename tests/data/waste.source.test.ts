import { describe, expect, it } from "vitest";
import { sourceDir, wasteStatisticsPart } from "@uk-data-atlas/datasets";

describe("wasteStatisticsPart", () => {
	it("reads collection rows as they are read from the ODS table", async () => {
		const parts = await wasteStatisticsPart(
			async (path, options, visit) => {
				expect(path).toBe(
					sourceDir(
						"waste",
						"LA_and_Regional_Spreadsheet_2024-25.ods",
					),
				);
				expect(options).toEqual({
					table: "Table_1",
					label: "Table_1",
					maxColumns: 32,
				});
				for (let index = 0; index < 4; index++) visit([]);
				const row = Array.from({ length: 32 }, () => "");
				row[0] = "2024-25";
				row[2] = "E06000001";
				row[4] = "Hartlepool";
				row[5] = "Collection";
				row[6] = "100";
				row[20] = "25";
				visit(row);
				// Disposal authorities are left out so tonnes are not counted twice.
				visit(
					Object.assign([...row], { 2: "E10000003", 5: "Disposal" }),
				);
			},
		);

		expect(parts).toEqual([
			{
				key: "2025",
				records: [
					{
						code: "E06000001",
						name: "Hartlepool",
						values: [
							{ measure: "collected-waste", value: 100 },
							{ measure: "household-waste-recycled", value: 25 },
						],
					},
				],
			},
		]);
	});
});
