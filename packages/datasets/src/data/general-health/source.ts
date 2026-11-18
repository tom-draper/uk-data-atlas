import type { DatasetReader } from "../catalog/types.ts";
import type { DirectPart, DirectRecord } from "../../declaration/statistics.ts";
import { parseNullableNum } from "../../helpers/parseNumber.ts";
import { sourceDir } from "../../declaration/sources.ts";

const COLUMNS = {
	veryGood: "Very good health",
	good: "Good health",
	fair: "Fair health",
	bad: "Bad health",
	veryBad: "Very bad health",
};

/**
 * Census 2021 general health (TS037) by LSOA, as the single part `2021`: usual
 * residents in each health band and in total. Areas with no residents, and
 * areas with a missing or negative count, are left out. Good health and its
 * share are computed, not stored.
 */
export async function generalHealthStatisticsParts(
	read: DatasetReader["csvRows"],
): Promise<DirectPart[]> {
	const records = new Map<string, DirectRecord>();
	await read(
		sourceDir("census-2021-ts037", "census2021-ts037-lsoa.csv"),
		{},
		(row) => {
			const code = row["geography code"]?.trim();
			const total = parseNullableNum(
				row["General health: Total: All usual residents"],
			);
			if (
				!code ||
				!/^[EW]01[0-9]{6}$/.test(code) ||
				total == null ||
				total <= 0
			)
				return;
			const counts: Record<string, number> = { total };
			for (const [key, column] of Object.entries(COLUMNS)) {
				const count = parseNullableNum(
					row["General health: " + column],
				);
				if (count == null || count < 0) return;
				counts[key] = count;
			}
			records.set(code, {
				code,
				name: row.geography?.trim() || code,
				values: Object.entries(counts).map(([key, value]) => ({
					measure: "usual-residents",
					members: { "general-health": key },
					value,
				})),
			});
		},
	);
	return [{ key: "2021", records: [...records.values()] }];
}
