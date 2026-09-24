import { odsTableRows } from "../spreadsheet/ods";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNullableNum } from "@/lib/helpers/parseNumber";
import type { IndicatorDataset, IndicatorRecord } from "@/lib/types/indicator";
import type { BoundaryType } from "../boundaries/catalog";

type IndicatorType =
	| "businessActivity"
	| "netAdditionalDwellings"
	| "localGovernmentFinance"
	| "councilTax"
	| "waste"
	| "adultSocialCareActivity"
	| "adultSocialCareOutcomes"
	| "planningApplications"
	| "electricVehicleChargers";

const source = (path: string) => path;
const numeric = (value: unknown) => parseNullableNum(value) ?? null;
// GSS local authority codes use different prefixes in each nation. England's
// county councils are E10 codes, which the adult-social-care returns include.
const authorityCode = (value: string) =>
	/^(?:E(?:0[6789])|W06|S12|N09)\d{6}$/.test(value);

// These two authorities are published on superseded codes in these releases.
// No official concordance accompanies the files, so they stay absent rather
// than being silently placed on a different current-boundary area.
const SUPERSEDED_LOCAL_AUTHORITY_CODES = new Set(["E08000016", "E08000019"]);
const mapAuthorityCode = (code: string) =>
	authorityCode(code) && !SUPERSEDED_LOCAL_AUTHORITY_CODES.has(code);

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

const table = (content: string, name: string, maxColumns = 64) =>
	odsTableRows(content, { table: name, label: name, maxColumns });

/** ONS table 1 reports broad-industry counts; summing them gives all enterprises. */
export async function loadBusinessActivity(
	read: (path: string, sheet: string) => Promise<string>,
) {
	const { data: rows } = await parseCsv<string[]>(
		await read(
			source(
				"economics/business-activity/ukbusinessworkbook2025new.xlsx",
			),
			"Table 1",
		),
		{ header: false },
	);
	const records: Record<string, IndicatorRecord> = {};
	for (const row of rows) {
		const [label, ...values] = row;
		const match = /^([EWSN]\d+)\s*:\s*(.+)$/.exec(label ?? "");
		if (!match || !mapAuthorityCode(match[1]!)) continue;
		const value = values.reduce(
			(sum, item) => sum + (numeric(item) ?? 0),
			0,
		);
		records[match[1]!] = { code: match[1]!, name: match[2]!.trim(), value };
	}
	return dataset("businessActivity", 2025, "localAuthority", 2025, records);
}

export async function loadNetAdditionalDwellings(
	read: (path: string) => Promise<string>,
) {
	const rows = table(
		await read(
			source(
				"economics/housing/net-additional-dwellings/Live_Table_122.ods",
			),
		),
		"LT_122",
		40,
	);
	const headers = rows[4] ?? [];
	const target = headers.findIndex((header) => header.startsWith("2024-25"));
	const records: Record<string, IndicatorRecord> = {};
	for (const row of rows.slice(5)) {
		const code = row[2]?.trim() ?? "";
		const value = numeric(row[target]);
		if (!mapAuthorityCode(code) || value === null) continue;
		records[code] = { code, name: row[3]?.trim() || code, value };
	}
	return dataset(
		"netAdditionalDwellings",
		2025,
		"localAuthority",
		2025,
		records,
	);
}

export async function loadLocalGovernmentFinance(
	read: (path: string) => Promise<string>,
) {
	const rows = table(
		await read(
			source(
				"economics/local-government-finance/RA_2026-27_data_Part_1.ods",
			),
		),
		"RA_LA_Data_2026-27",
		128,
	);
	const headers = rows[9] ?? [];
	const valueColumn = headers.indexOf("TOTAL EDUCATION SERVICES");
	const records: Record<string, IndicatorRecord> = {};
	for (const row of rows.slice(10)) {
		const code = row[1]?.trim() ?? "";
		const value = numeric(row[valueColumn]);
		if (!mapAuthorityCode(code) || value === null) continue;
		records[code] = { code, name: row[2]?.trim() || code, value };
	}
	return dataset(
		"localGovernmentFinance",
		2026,
		"localAuthority",
		2026,
		records,
	);
}

export async function loadCouncilTax(read: (path: string) => Promise<string>) {
	const rows = table(
		await read(
			source(
				"economics/local-government-finance/council-tax/Table_10_2026-27.ods",
			),
		),
		"Data_Billing",
		64,
	);
	const headers = rows[4] ?? [];
	const valueColumn = headers.findIndex(
		(header) =>
			header.startsWith("8. Average") &&
			header.includes("(current year)"),
	);
	const records: Record<string, IndicatorRecord> = {};
	for (const row of rows.slice(5)) {
		const code = row[1]?.trim() ?? "";
		const value = numeric(row[valueColumn]);
		if (!mapAuthorityCode(code) || value === null) continue;
		records[code] = { code, name: row[2]?.trim() || code, value };
	}
	return dataset("councilTax", 2026, "localAuthority", 2026, records);
}

export async function loadWaste(read: (path: string) => Promise<string>) {
	const rows = table(
		await read(
			source("environment/waste/LA_and_Regional_Spreadsheet_2024-25.ods"),
		),
		"Table_1",
		32,
	);
	const records: Record<string, IndicatorRecord> = {};
	for (const row of rows.slice(4)) {
		const code = row[2]?.trim() ?? "";
		const total = numeric(row[6]);
		const recycled = numeric(row[20]);
		if (
			row[0] !== "2024-25" ||
			row[5] !== "Collection" ||
			!mapAuthorityCode(code) ||
			total === null
		)
			continue;
		records[code] = {
			code,
			name: row[4]?.trim() || code,
			value: total,
			...(recycled === null
				? {}
				: { metrics: { recycledTonnes: recycled } }),
		};
	}
	return dataset("waste", 2025, "localAuthority", 2025, records);
}

export async function loadAdultSocialCareActivity(
	read: (path: string) => Promise<string>,
) {
	const rows = table(
		await read(
			source(
				"health/adult-social-care/activity/asc-activity-report-england-2024-to-2025-data-tables-updated-june-2026.ods",
			),
		),
		"Table_2",
		20,
	);
	const records: Record<string, IndicatorRecord> = {};
	for (const row of rows.slice(4)) {
		const code = row[0]?.trim() ?? "";
		const workingAge = numeric(row[9]);
		const older = numeric(row[10]);
		if (!mapAuthorityCode(code) || workingAge === null || older === null)
			continue;
		records[code] = {
			code,
			name: row[2]?.trim() || code,
			value: workingAge + older,
		};
	}
	return dataset(
		"adultSocialCareActivity",
		2025,
		"localAuthority",
		2025,
		records,
	);
}

export async function loadAdultSocialCareOutcomes(
	read: (path: string) => Promise<string>,
) {
	const rows = table(
		await read(
			source(
				"health/adult-social-care/ascof/dhsc-ascof-england-2024-to-2025-outcome-and-demographic-data-23-january-2026.ods",
			),
		),
		"Table_1a",
		16,
	);
	const records: Record<string, IndicatorRecord> = {};
	for (const row of rows.slice(6)) {
		const code = row[1]?.trim() ?? "";
		const value = numeric(row[8]);
		if (
			row[3] !== "Local Authority" ||
			row[4] !== "Total" ||
			row[5] !== "Total" ||
			!mapAuthorityCode(code) ||
			value === null
		)
			continue;
		records[code] = { code, name: row[0]?.trim() || code, value };
	}
	return dataset(
		"adultSocialCareOutcomes",
		2025,
		"localAuthority",
		2025,
		records,
	);
}

export async function loadPlanningApplications(
	read: (path: string) => Promise<string>,
) {
	const { data } = await parseCsv<Record<string, string>>(
		await read(
			source("housing/planning-applications/ps1-full-2026-03.csv"),
		),
		{ header: true, skipLines: 3 },
	);
	const records: Record<string, IndicatorRecord> = {};
	for (const row of data) {
		const code = row.LPACD?.trim() ?? "";
		const value = numeric(row["Applications received"]);
		if (
			row.Quarter !== "2026 Q1" ||
			!mapAuthorityCode(code) ||
			value === null
		)
			continue;
		records[code] = { code, name: row.LPANM?.trim() || code, value };
	}
	return dataset(
		"planningApplications",
		2026,
		"localAuthority",
		2025,
		records,
	);
}

export async function loadElectricVehicleChargers(
	read: (path: string) => Promise<string>,
) {
	const rows = table(
		await read(
			source(
				"transport/electric-vehicle-chargers/evci0102_2026-07_EV_chargers_by_local_authority_UK.ods",
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
	return dataset(
		"electricVehicleChargers",
		2026,
		"localAuthority",
		2026,
		records,
	);
}
