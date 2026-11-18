import type { DatasetReader } from "../catalog/types.ts";
import type { DirectPart, DirectRecord } from "../../declaration/statistics.ts";
import { parseNullableNum } from "../../helpers/parseNumber.ts";
import { sourceDir } from "../../declaration/sources.ts";

const COLUMNS = {
	owned: "Owned",
	outright: "Owned: Owns outright",
	mortgage: "Owned: Owns with a mortgage or loan",
	shared: "Shared ownership",
	social: "Social rented",
	private: "Private rented",
	rentFree: "Lives rent free",
};

/**
 * Census 2021 housing tenure (TS054) by LSOA, as the single part `2021`:
 * households in each tenure and in total. Areas with no households, and areas
 * with a missing or negative count, are left out. The owned share is computed,
 * not stored.
 */
export async function housingTenureStatisticsParts(
	read: DatasetReader["csvRows"],
): Promise<DirectPart[]> {
	const records = new Map<string, DirectRecord>();
	await read(
		sourceDir("census-2021-ts054", "census2021-ts054-lsoa.csv"),
		{},
		(row) => {
			const code = row["geography code"]?.trim();
			const total = parseNullableNum(
				row["Tenure of household: Total: All households"],
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
					row["Tenure of household: " + column],
				);
				if (count == null || count < 0) return;
				counts[key] = count;
			}
			records.set(code, {
				code,
				name: row.geography?.trim() || code,
				values: Object.entries(counts).map(([key, value]) => ({
					measure: "households",
					members: { tenure: key },
					value,
				})),
			});
		},
	);
	return [{ key: "2021", records: [...records.values()] }];
}
