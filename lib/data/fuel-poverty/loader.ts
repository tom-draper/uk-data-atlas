import {
	FuelPovertyDataset,
	FuelPovertyLSOAData,
} from "@/lib/types/fuelPoverty";
import type { OdsTableOptions } from "@/lib/data/spreadsheet/ods";

const TABLE_NAME = "Table_4";

const TABLE_OPTIONS: OdsTableOptions = {
	table: TABLE_NAME,
	label: "fuel-poverty",
	maxColumns: 8,
};

export async function loadFuelPoverty(
	readRows: (
		path: string,
		options: OdsTableOptions,
		visit: (row: readonly string[]) => void,
	) => Promise<void>,
): Promise<Record<string, FuelPovertyDataset>> {
	const data: Record<string, FuelPovertyLSOAData> = {};
	await readRows(
		"economics/fuel-poverty/fuel-poverty-2024.ods",
		TABLE_OPTIONS,
		([lsoaCode, lsoaName, , , , households, fuelPoor, rate]) => {
			if (!/^E01\d{6}$/.test(lsoaCode)) return;
			const householdCount = Number(households),
				fuelPoorHouseholdCount = Number(fuelPoor),
				fuelPovertyRate = Number(rate);
			if (
				![
					householdCount,
					fuelPoorHouseholdCount,
					fuelPovertyRate,
				].every(Number.isFinite)
			)
				return;
			data[lsoaCode] = {
				lsoaCode,
				lsoaName,
				householdCount,
				fuelPoorHouseholdCount,
				fuelPovertyRate,
			};
		},
	);
	return {
		2024: {
			id: "fuelPoverty2024",
			type: "fuelPoverty",
			year: 2024,
			boundaryType: "lsoa",
			boundaryYear: 2011,
			data,
		},
	};
}
