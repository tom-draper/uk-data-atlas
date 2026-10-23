import type { DatasetReader } from "../catalog/types";
import type { IndicatorDataset, IndicatorRecord } from "../../types/indicator";
import { parseNullableNum } from "../../helpers/parseNumber";
export async function loadGeneralHealth(
	read: DatasetReader["csvRows"],
): Promise<Record<string, IndicatorDataset<"generalHealth">>> {
	const data: Record<string, IndicatorRecord> = {};
	await read(
		"demographics/census-2021-small-area/ts037/census2021-ts037-lsoa.csv",
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
			const columns = {
				veryGood: "Very good health",
				good: "Good health",
				fair: "Fair health",
				bad: "Bad health",
				veryBad: "Very bad health",
			};
			const metrics: Record<string, number> = { total };
			for (const [key, column] of Object.entries(columns)) {
				const count = parseNullableNum(
					row["General health: " + column],
				);
				if (count == null || count < 0) return;
				metrics[key] = count;
			}
			metrics.goodHealth = metrics.veryGood + metrics.good;
			data[code] = {
				code,
				name: row.geography?.trim() || code,
				value: (metrics.goodHealth / total) * 100,
				metrics,
			};
		},
	);
	return {
		2021: {
			id: "generalHealth2021",
			type: "generalHealth",
			year: 2021,
			boundaryType: "lsoa",
			boundaryYear: 2021,
			data,
		},
	};
}
