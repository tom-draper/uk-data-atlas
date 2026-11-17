import type { DirectPart } from "../../declaration/statistics.ts";
import { sourceDir } from "../../declaration/sources.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";
import { parseNullableNum } from "../../helpers/parseNumber.ts";
import { mapAuthorityCode } from "../new-datasets/authorityCode.ts";

/**
 * VAT and/or PAYE based enterprises of each local authority district, 2025.
 * Table 1 lists the broad industries and then their total; the total is read
 * as adding up the row would count every business twice.
 */
export async function businessActivityStatisticsPart(
	read: (path: string, sheet: string) => Promise<string>,
): Promise<DirectPart[]> {
	const { data: rows } = await parseCsv<string[]>(
		await read(
			sourceDir("business-activity", "ukbusinessworkbook2025new.xlsx"),
			"Table 1",
		),
		{ header: false },
	);
	const total = rows.find((row) => row.includes("Total"))?.indexOf("Total");
	if (total === undefined)
		throw new Error("Business activity Table 1 has no Total column.");
	const records = new Map<string, DirectPart["records"][number]>();
	for (const row of rows) {
		const match = /^([EWSN]\d+)\s*:\s*(.+)$/.exec(row[0] ?? "");
		const value = parseNullableNum(row[total]) ?? null;
		if (!match || !mapAuthorityCode(match[1]!) || value === null) continue;
		records.set(match[1]!, {
			code: match[1]!,
			name: match[2]!.trim(),
			values: [{ measure: "enterprises", value }],
		});
	}
	return [{ key: "2025", records: [...records.values()] }];
}
