import { AgeData, PopulationDataset } from "@/lib/types";

type XlsxSheetRowReader = (
	path: string,
	sheet: string,
	visit: (row: ReadonlyMap<number, string>) => void,
) => Promise<void>;

type AgeColumn = { index: number; age: string; sex: "F" | "M" };

const cell = (row: ReadonlyMap<number, string>, index: number) =>
	row.get(index)?.trim() ?? "";

export async function loadPopulation(
	readRows: XlsxSheetRowReader,
): Promise<Record<string, PopulationDataset>> {
	const combinedData: PopulationDataset["data"] = {};
	let rowIndex = 0;
	let ageColumns: AgeColumn[] | undefined;
	await readRows(
		"demographics/population/small-area-estimates/population-ward-estimates/sapewardstablefinal.xlsx",
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

			const females: AgeData = {};
			const males: AgeData = {};
			const total: AgeData = {};
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

			combinedData[wardCode] = {
				total,
				males,
				females,
				wardName: cell(row, 3),
				ladCode: laCode,
				ladName: cell(row, 1),
			};
		},
	);

	return {
		2022: {
			id: "population2022",
			type: "population",
			year: 2022,
			boundaryYear: 2023,
			boundaryType: "ward",
			data: combinedData,
		},
	};
}
