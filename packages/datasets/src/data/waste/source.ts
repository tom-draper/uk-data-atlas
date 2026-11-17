import type { OdsTableOptions } from "../spreadsheet/ods.ts";
import type { DirectPart, DirectRecord } from "../../declaration/statistics.ts";
import { sourceDir } from "../../declaration/sources.ts";
import { parseNullableNum } from "../../helpers/parseNumber.ts";
import { mapAuthorityCode } from "../new-datasets/authorityCode.ts";

/**
 * Local authority collected waste of 2024-25, collection authorities only so a
 * tonne is not counted by both a county and its districts.
 */
export async function wasteStatisticsPart(
	readRows: (
		path: string,
		options: OdsTableOptions,
		visit: (row: readonly string[]) => void,
	) => Promise<void>,
): Promise<DirectPart[]> {
	const records = new Map<string, DirectRecord>();
	let rowIndex = 0;
	await readRows(
		sourceDir("waste", "LA_and_Regional_Spreadsheet_2024-25.ods"),
		{ table: "Table_1", label: "Table_1", maxColumns: 32 },
		(row) => {
			if (rowIndex++ < 4) return;
			const code = row[2]?.trim() ?? "";
			const total = parseNullableNum(row[6]) ?? null;
			const recycled = parseNullableNum(row[20]) ?? null;
			if (
				row[0] !== "2024-25" ||
				row[5] !== "Collection" ||
				!mapAuthorityCode(code) ||
				total === null
			)
				return;
			records.set(code, {
				code,
				name: row[4]?.trim() || code,
				values: [
					{ measure: "collected-waste", value: total },
					...(recycled === null
						? []
						: [
								{
									measure: "household-waste-recycled",
									value: recycled,
								},
							]),
				],
			});
		},
	);
	return [{ key: "2025", records: [...records.values()] }];
}
