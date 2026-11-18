import type { DirectPart, DirectValue } from "../../declaration/statistics.ts";
import { sourceDir } from "../../declaration/sources.ts";

type XlsxSheetRowReader = (
	path: string,
	sheet: string,
	visit: (row: ReadonlyMap<number, string>) => void,
) => Promise<void>;

type AgeColumn = { index: number; age: string; sex: "F" | "M" };

const cell = (row: ReadonlyMap<number, string>, index: number) =>
	row.get(index)?.trim() ?? "";

/** Mid-2022 population estimates by ward, sex and single year of age. */
export async function populationStatisticsParts(
	readRows: XlsxSheetRowReader,
): Promise<DirectPart[]> {
	const records: DirectPart["records"] = [];
	let rowIndex = 0;
	let ageColumns: AgeColumn[] | undefined;
	await readRows(
		sourceDir("population", "sapewardstablefinal.xlsx"),
		"Mid-2022 Ward 2023",
		(row) => {
			if (rowIndex++ < 3) return;
			if (!ageColumns) {
				ageColumns = [...row.entries()].flatMap<AgeColumn>(
					([index, name]) => {
						if (index < 5) return [];
						const column = name.trim();
						if (column.startsWith("F"))
							return [
								{
									index,
									age: column.substring(1),
									sex: "F" as const,
								},
							];
						if (column.startsWith("M"))
							return [
								{
									index,
									age: column.substring(1),
									sex: "M" as const,
								},
							];
						return [];
					},
				);
				return;
			}

			const laCode = cell(row, 0);
			const wardCode = cell(row, 2);
			if (!laCode || !wardCode) return;

			const females: Record<string, number> = {};
			const males: Record<string, number> = {};
			const total: Record<string, number> = {};
			for (const { index, age, sex } of ageColumns) {
				const value = cell(row, index);
				if (!value) continue;
				const count = parseInt(value.replace(/,/g, ""), 10);
				if (isNaN(count)) continue;
				if (sex === "F") females[age] = count;
				else males[age] = count;
				total[age] = (total[age] || 0) + count;
			}
			if (Object.keys(total).length === 0) return;

			const values: DirectValue[] = [];
			for (const [sex, counts] of [
				["all", total],
				["male", males],
				["female", females],
			] as const)
				for (const [age, value] of Object.entries(counts))
					values.push({
						measure: "population",
						members: { sex, age },
						value,
					});
			records.push({
				code: wardCode,
				name: cell(row, 3),
				parents: { ladCode: { code: laCode, name: cell(row, 1) } },
				values,
			});
		},
	);

	return [{ key: "2022", records }];
}
