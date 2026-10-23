import type { DatasetReader } from "../catalog/types";
import type { IndicatorDataset, IndicatorRecord } from "../../types/indicator";
import { parseNullableNum } from "../../helpers/parseNumber";
export async function loadHousingTenure(
	read: DatasetReader["csvRows"],
): Promise<Record<string, IndicatorDataset<"housingTenure">>> {
	const data: Record<string, IndicatorRecord> = {};
	await read(
		"demographics/census-2021-small-area/ts054/census2021-ts054-lsoa.csv",
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
			const columns = {
				owned: "Owned",
				outright: "Owned: Owns outright",
				mortgage: "Owned: Owns with a mortgage or loan",
				shared: "Shared ownership",
				social: "Social rented",
				private: "Private rented",
				rentFree: "Lives rent free",
			};
			const metrics: Record<string, number> = { total };
			for (const [key, column] of Object.entries(columns)) {
				const count = parseNullableNum(
					row["Tenure of household: " + column],
				);
				if (count == null || count < 0) return;
				metrics[key] = count;
			}

			data[code] = {
				code,
				name: row.geography?.trim() || code,
				value: (metrics.owned / total) * 100,
				metrics,
			};
		},
	);
	return {
		2021: {
			id: "housingTenure2021",
			type: "housingTenure",
			year: 2021,
			boundaryType: "lsoa",
			boundaryYear: 2021,
			data,
		},
	};
}
