import type { DirectPart, DirectRecord } from "../../declaration/statistics.ts";
import { sourceDir } from "../../declaration/sources.ts";
import { parseNullableNum } from "../../helpers/parseNumber.ts";
import { odsTableRows } from "../spreadsheet/ods.ts";
import { mapAuthorityCode } from "../new-datasets/authorityCode.ts";

/** Public electric vehicle charging devices of each local authority, July 2026. */
export async function electricVehicleChargerStatisticsPart(
	read: (path: string) => Promise<string>,
): Promise<DirectPart[]> {
	const rows = odsTableRows(
		await read(
			sourceDir(
				"electric-vehicle-chargers",
				"evci0102_2026-07_EV_chargers_by_local_authority_UK.ods",
			),
		),
		{ table: "EVCI0102a", label: "EVCI0102a", maxColumns: 8 },
	);
	const records = new Map<string, DirectRecord>();
	for (const row of rows.slice(3)) {
		const code = row[0]?.trim() ?? "";
		const value = parseNullableNum(row[4]) ?? null;
		if (!mapAuthorityCode(code) || value === null) continue;
		records.set(code, {
			code,
			name: row[1]?.trim() || code,
			values: [{ measure: "public-ev-chargers", value }],
		});
	}
	return [{ key: "2026", records: [...records.values()] }];
}
