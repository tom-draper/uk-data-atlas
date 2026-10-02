import { describe, expect, it } from "vitest";
import { loadWaste } from "@/lib/data/new-datasets/loader";

describe("loadWaste", () => {
	it("aggregates collection rows as they are read from the ODS table", async () => {
		const result = await loadWaste(async (path, options, visit) => {
			expect(path).toBe(
				"environment/waste/LA_and_Regional_Spreadsheet_2024-25.ods",
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
		});

		expect(result[2025]?.data.E06000001).toEqual({
			code: "E06000001",
			name: "Hartlepool",
			value: 100,
			metrics: { recycledTonnes: 25 },
		});
	});
});
