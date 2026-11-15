import { describe, expect, it } from "vitest";
import {
	fuelPoverty,
	sourceDir,
	type DatasetReader,
} from "@uk-data-atlas/datasets";

const read = fuelPoverty.statistics.direct!.read;
const row = (code: string, ...rest: string[]) => [
	code,
	"Example LSOA",
	"",
	"",
	"",
	...rest,
];

describe("fuel poverty read straight from its workbook", () => {
	const reader = (rows: string[][]) =>
		({
			odsTableRows: async (
				path: string,
				options: unknown,
				visit: (row: string[]) => void,
			) => {
				expect(path).toBe(
					sourceDir("fuel-poverty", "fuel-poverty-2024.ods"),
				);
				expect(options).toEqual({
					table: "Table_4",
					label: "fuel-poverty",
					maxColumns: 8,
				});
				rows.forEach(visit);
			},
		}) as unknown as DatasetReader;

	it("reads each LSOA's households, fuel poor households and rate", async () => {
		const parts = await read(
			reader([row("E01000001", "100", "20", "0.2")]),
		);
		expect(parts).toEqual([
			{
				key: "2024",
				records: [
					{
						code: "E01000001",
						name: "Example LSOA",
						values: [
							{ measure: "households", value: 100 },
							{ measure: "fuel-poor-households", value: 20 },
							{ measure: "fuel-poverty-rate", value: 0.2 },
						],
					},
				],
			},
		]);
	});

	it("skips what is not an English LSOA or has no number", async () => {
		const parts = await read(
			reader([
				row("W01000001", "1", "1", "1"),
				row("E01000002", "x", "1", "1"),
				row("E01000003", "5", "1", "0.2"),
			]),
		);
		expect(parts[0]!.records.map(({ code }) => code)).toEqual([
			"E01000003",
		]);
	});
});
