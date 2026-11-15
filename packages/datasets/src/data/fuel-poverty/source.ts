import type { OdsTableOptions } from "../spreadsheet/ods.ts";
import { sourceDir } from "../../declaration/sources.ts";

const TABLE_NAME = "Table_4";

export const FUEL_POVERTY_SOURCE = sourceDir(
	"fuel-poverty",
	"fuel-poverty-2024.ods",
);

export const TABLE_OPTIONS: OdsTableOptions = {
	table: TABLE_NAME,
	label: "fuel-poverty",
	maxColumns: 8,
};
