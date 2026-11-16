import { odsTableRows, type OdsTableOptions } from "../spreadsheet/ods.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";
import { parseNullableNum } from "../../helpers/parseNumber.ts";
import { loadPopulationUk } from "../population/ukLoader.ts";
import type {
	IndicatorDataset,
	IndicatorRecord,
} from "../../types/indicator.ts";
import type { BoundaryType } from "../boundaries/catalog.ts";
import { sourceDir } from "../../declaration/sources.ts";

type IndicatorType =
	| "business-activity"
	| "net-additional-dwellings"
	| "local-government-finance"
	| "council-tax"
	| "waste"
	| "adult-social-care-activity"
	| "adult-social-care-outcomes"
	| "planning-applications"
	| "electric-vehicle-chargers"
	| "housing-affordability";

const source = (path: string) => path;
const numeric = (value: unknown) => parseNullableNum(value) ?? null;
import { authorityCode, mapAuthorityCode } from "./authorityCode.ts";

const dataset = <T extends IndicatorType>(
	type: T,
	year: number,
	boundaryType: BoundaryType,
	boundaryYear: number,
	data: Record<string, IndicatorRecord>,
): Record<string, IndicatorDataset<T>> => ({
	[String(year)]: {
		id: `${type}${year}`,
		type,
		year,
		boundaryType,
		boundaryYear,
		data,
	},
});

async function addPopulationMetrics(
	records: Record<string, IndicatorRecord>,
	readSheet: (path: string, sheet: string) => Promise<string>,
) {
	const population = await loadPopulationUk(readSheet);
	const latest = population["2024"]?.data ?? {};
	for (const [code, record] of Object.entries(records)) {
		const total = Object.values(latest[code]?.total ?? {}).reduce(
			(sum, value) => sum + value,
			0,
		);
		if (total > 0) {
			record.metrics = {
				per100kPopulation: (record.value / total) * 100_000,
			};
		}
	}
}

const table = (content: string, name: string, maxColumns = 64) =>
	odsTableRows(content, { table: name, label: name, maxColumns });

/** ONS table 1 reports broad-industry counts; summing them gives all enterprises. */
export async function loadBusinessActivity(
	read: (path: string, sheet: string) => Promise<string>,
	readPopulation: (path: string, sheet: string) => Promise<string> = read,
) {
	const { data: rows } = await parseCsv<string[]>(
		await read(
			source(
				sourceDir(
					"business-activity",
					"ukbusinessworkbook2025new.xlsx",
				),
			),
			"Table 1",
		),
		{ header: false },
	);
	// Each row lists its broad industries and then their total. Read the
	// total, as adding up the row would count every business twice.
	const total = rows.find((row) => row.includes("Total"))?.indexOf("Total");
	if (total === undefined)
		throw new Error("Business activity Table 1 has no Total column.");
	const records: Record<string, IndicatorRecord> = {};
	for (const row of rows) {
		const match = /^([EWSN]\d+)\s*:\s*(.+)$/.exec(row[0] ?? "");
		const value = numeric(row[total]);
		if (!match || !mapAuthorityCode(match[1]!) || value === null) continue;
		records[match[1]!] = { code: match[1]!, name: match[2]!.trim(), value };
	}
	await addPopulationMetrics(records, readPopulation);
	return dataset("business-activity", 2025, "localAuthority", 2025, records);
}

export async function loadWaste(
	readRows: (
		path: string,
		options: OdsTableOptions,
		visit: (row: readonly string[]) => void,
	) => Promise<void>,
) {
	const records: Record<string, IndicatorRecord> = {};
	let rowIndex = 0;
	await readRows(
		source(sourceDir("waste", "LA_and_Regional_Spreadsheet_2024-25.ods")),
		{ table: "Table_1", label: "Table_1", maxColumns: 32 },
		(row) => {
			if (rowIndex++ < 4) return;
			const code = row[2]?.trim() ?? "";
			const total = numeric(row[6]);
			const recycled = numeric(row[20]);
			if (
				row[0] !== "2024-25" ||
				row[5] !== "Collection" ||
				!mapAuthorityCode(code) ||
				total === null
			)
				return;
			records[code] = {
				code,
				name: row[4]?.trim() || code,
				value: total,
				...(recycled === null
					? {}
					: { metrics: { recycledTonnes: recycled } }),
			};
		},
	);
	return dataset("waste", 2025, "localAuthority", 2025, records);
}

export async function loadPlanningApplications(
	readRows: (
		path: string,
		options: { skipLines?: number },
		visit: (row: Readonly<Record<string, string>>) => void,
	) => Promise<void>,
) {
	const records: Record<string, IndicatorRecord> = {};
	await readRows(
		source(sourceDir("planning-applications", "ps1-full-2026-03.csv")),
		{ skipLines: 3 },
		(row) => {
			const code = row.LPACD?.trim() ?? "";
			const value = numeric(row["Applications received"]);
			if (
				row.Quarter !== "2026 Q1" ||
				!mapAuthorityCode(code) ||
				value === null
			)
				return;
			const metrics = Object.fromEntries(
				(
					[
						["decided", "Applications decided"],
						["withdrawn", "Applications withdrawn"],
					] as const
				).flatMap(([key, column]) => {
					const number = numeric(row[column]);
					return number === null ? [] : [[key, number]];
				}),
			);
			records[code] = {
				code,
				name: row.LPANM?.trim() || code,
				value,
				metrics,
			};
		},
	);
	return dataset(
		"planning-applications",
		2026,
		"localAuthority",
		2025,
		records,
	);
}

export async function loadElectricVehicleChargers(
	read: (path: string) => Promise<string>,
	readPopulation: (path: string, sheet: string) => Promise<string>,
) {
	const rows = table(
		await read(
			source(
				sourceDir(
					"electric-vehicle-chargers",
					"evci0102_2026-07_EV_chargers_by_local_authority_UK.ods",
				),
			),
		),
		"EVCI0102a",
		8,
	);
	const records: Record<string, IndicatorRecord> = {};
	for (const row of rows.slice(3)) {
		const code = row[0]?.trim() ?? "";
		const value = numeric(row[4]);
		if (!mapAuthorityCode(code) || value === null) continue;
		records[code] = { code, name: row[1]?.trim() || code, value };
	}
	await addPopulationMetrics(records, readPopulation);
	return dataset(
		"electric-vehicle-chargers",
		2026,
		"localAuthority",
		2026,
		records,
	);
}

/**
 * ONS table 5c: the ratio of the median price paid for existing dwellings
 * (year ending September) to median gross annual residence-based earnings.
 * Authorities ONS suppresses for the year ("[x]") are left out.
 */
export async function loadHousingAffordability(
	read: (path: string, sheet: string) => Promise<string>,
) {
	const year = 2025;
	const { data: rows } = await parseCsv<string[]>(
		await read(
			source(
				sourceDir(
					"housing-affordability",
					"ons-ew-existing-dwellings-residence-earnings-2025.xlsx",
				),
			),
			"5c",
		),
		{ header: false },
	);
	const headerIndex = rows.findIndex(
		(row) => row[2]?.trim() === "Local authority code",
	);
	const headers = rows[headerIndex] ?? [];
	const valueColumn = headers.findIndex(
		(header) => header?.trim() === String(year),
	);
	if (headerIndex < 0 || valueColumn < 0)
		throw new Error(
			`Housing affordability table 5c has no ${year} local authority column`,
		);
	const records: Record<string, IndicatorRecord> = {};
	for (const row of rows.slice(headerIndex + 1)) {
		const code = row[2]?.trim() ?? "";
		const value = numeric(row[valueColumn]);
		if (!authorityCode(code) || value === null) continue;
		records[code] = { code, name: row[3]?.trim() || code, value };
	}
	return dataset(
		"housing-affordability",
		year,
		"localAuthority",
		year,
		records,
	);
}
