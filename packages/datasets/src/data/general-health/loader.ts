import type { DatasetReader } from "../catalog/types.ts";
import type {
	IndicatorDataset,
	IndicatorRecord,
} from "../../types/indicator.ts";
import { parseNullableNum } from "../../helpers/parseNumber.ts";
import { sourceDir } from "../../declaration/sources.ts";
export async function loadGeneralHealth(
	read: DatasetReader["csvRows"],
): Promise<Record<string, IndicatorDataset<"general-health">>> {
	const data: Record<string, IndicatorRecord> = {};
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
			id: "general-health2021",
			type: "general-health",
			year: 2021,
			boundaryType: "lsoa",
			boundaryYear: 2021,
			data,
		},
	};
}
