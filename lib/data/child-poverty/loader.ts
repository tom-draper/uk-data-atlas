import {
	ChildPovertyDataset,
	ChildPovertyLADData,
} from "@/lib/types/childPoverty";
import type { OdsTableOptions } from "@/lib/data/spreadsheet/ods";

const TABLE_NAME = "7_BHC_Relative_LA";
const YEARS = [2022, 2023, 2024, 2025] as const;

const TABLE_OPTIONS: OdsTableOptions = {
	table: TABLE_NAME,
	label: "child-poverty",
	maxColumns: 10,
};

export async function loadChildPoverty(
	readRows: (
		path: string,
		options: OdsTableOptions,
		visit: (row: readonly string[]) => void,
	) => Promise<void>,
): Promise<Record<string, ChildPovertyDataset>> {
	const recordsByYear = new Map<number, Record<string, ChildPovertyLADData>>(
		YEARS.map((year) => [year, {}]),
	);

	await readRows(
		"economics/child-poverty/children-in-low-income-families-2022-2025.ods",
		TABLE_OPTIONS,
		(row) => {
			const [ladName, ladCode, ...values] = row;
			if (!ladName || !ladCode || !/^[EWSN]\d{8}$/.test(ladCode)) return;

			for (const [index, year] of YEARS.entries()) {
				const childCount = Number(values[index]);
				const childPovertyRate =
					Number(values[index + YEARS.length]) * 100;
				if (
					!Number.isFinite(childCount) ||
					!Number.isFinite(childPovertyRate) ||
					childPovertyRate <= 0
				)
					continue;
				recordsByYear.get(year)![ladCode] = {
					ladCode,
					ladName,
					childCount,
					childrenPopulation: childCount / (childPovertyRate / 100),
					childPovertyRate,
				};
			}
		},
	);

	return Object.fromEntries(
		YEARS.map((year) => [
			year,
			{
				id: `childPoverty${year}`,
				type: "childPoverty" as const,
				year,
				measure: "relativeLowIncomeBeforeHousingCosts" as const,
				boundaryType: "localAuthority" as const,
				boundaryYear: 2024,
				data: recordsByYear.get(year)!,
			},
		]),
	);
}
