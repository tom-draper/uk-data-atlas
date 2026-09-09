/**
 * The framework-neutral custom-import pipeline. Parsers produce a document,
 * the UI chooses a plan, and this module validates and materialises the map
 * dataset. Keeping those stages separate lets new file formats and mappings
 * arrive without teaching map rendering about raw uploads.
 */
import type { BoundaryType } from "@/lib/types/boundaries";
import type { CustomDataset, CustomPoint } from "@/lib/types/custom";

export interface CustomImportDocument {
	fileName: string;
	format: "csv";
	rows: string[][];
	headerRow: number;
}

export type CustomImportPlan =
	| {
			kind: "choropleth";
			codeColumn: string;
			valueColumn: string;
			boundaryType: BoundaryType;
			boundaryYear: number;
			/** Present when the selected geography was matched by area name. */
			nameToCode?: ReadonlyMap<string, string>;
	  }
	| {
			kind: "points";
			latitudeColumn: string;
			longitudeColumn: string;
			valueColumn: string;
	  };

export interface CustomImport {
	document: CustomImportDocument;
	plan: CustomImportPlan;
}

export interface CustomImportIssue {
	severity: "error" | "warning";
	code: "missing-column" | "invalid-row";
	message: string;
	/** A bounded sample of one-based spreadsheet row numbers. */
	rows?: number[];
	count?: number;
}

export interface CustomImportReport {
	valid: boolean;
	acceptedRows: number;
	rejectedRows: number;
	issues: CustomImportIssue[];
}

export interface MaterialisedCustomImport {
	dataset: CustomDataset | null;
	report: CustomImportReport;
}

export const createCsvImportDocument = (
	fileName: string,
	rows: string[][],
	headerRow: number,
): CustomImportDocument => ({ fileName, format: "csv", rows, headerRow });

type ColumnIndexes = Record<string, number>;

const columnIndexes = (
	document: CustomImportDocument,
	plan: CustomImportPlan,
): { indexes: ColumnIndexes; issues: CustomImportIssue[] } => {
	const headers = document.rows[document.headerRow] ?? [];
	const columns =
		plan.kind === "choropleth"
			? { code: plan.codeColumn, value: plan.valueColumn }
			: {
					latitude: plan.latitudeColumn,
					longitude: plan.longitudeColumn,
					value: plan.valueColumn,
				};
	const indexes: ColumnIndexes = {};
	const missing: string[] = [];
	for (const [key, column] of Object.entries(columns)) {
		const index = headers.indexOf(column);
		if (index === -1) missing.push(column);
		else indexes[key] = index;
	}
	return {
		indexes,
		issues: missing.length
			? [
					{
						severity: "error",
						code: "missing-column",
						message: `The import plan refers to missing column${
							missing.length === 1 ? "" : "s"
						}: ${missing.join(", ")}`,
					},
				]
			: [],
	};
};

const invalidRowsIssue = (rows: number[]): CustomImportIssue | undefined =>
	rows.length > 0
		? {
				severity: "warning",
				code: "invalid-row",
				message: `Ignored ${rows.length} row${rows.length === 1 ? "" : "s"} with missing or invalid values.`,
				rows: rows.slice(0, 10),
				count: rows.length,
			}
		: undefined;

/**
 * Validates column bindings and reports the rows that materialisation would
 * skip. Invalid values are warnings because the existing upload experience
 * intentionally accepts a useful partial dataset.
 */
export function validateCustomImport(
	document: CustomImportDocument,
	plan: CustomImportPlan,
): CustomImportReport {
	const { indexes, issues } = columnIndexes(document, plan);
	if (issues.length > 0) {
		return { valid: false, acceptedRows: 0, rejectedRows: 0, issues };
	}

	let acceptedRows = 0;
	const invalidRows: number[] = [];
	for (const [index, row] of document.rows
		.slice(document.headerRow + 1)
		.entries()) {
		const value = Number.parseFloat(row[indexes.value]!);
		if (plan.kind === "choropleth") {
			if (!row[indexes.code]?.trim() || Number.isNaN(value)) {
				invalidRows.push(document.headerRow + index + 2);
				continue;
			}
		} else {
			const latitude = Number.parseFloat(row[indexes.latitude]!);
			const longitude = Number.parseFloat(row[indexes.longitude]!);
			if (
				Number.isNaN(latitude) ||
				Number.isNaN(longitude) ||
				Number.isNaN(value)
			) {
				invalidRows.push(document.headerRow + index + 2);
				continue;
			}
		}
		acceptedRows++;
	}
	const warning = invalidRowsIssue(invalidRows);
	return {
		valid: true,
		acceptedRows,
		rejectedRows: invalidRows.length,
		issues: warning ? [warning] : [],
	};
}

/** Turns a validated document and plan into the compact dataset map renderers use. */
export function materialiseCustomImport(
	id: string,
	document: CustomImportDocument,
	plan: CustomImportPlan,
): MaterialisedCustomImport {
	const report = validateCustomImport(document, plan);
	if (!report.valid) return { dataset: null, report };

	const { indexes } = columnIndexes(document, plan);
	const rows = document.rows.slice(document.headerRow + 1);
	if (plan.kind === "points") {
		const points: CustomPoint[] = [];
		let valueMin = Infinity;
		let valueMax = -Infinity;
		for (const row of rows) {
			const lat = Number.parseFloat(row[indexes.latitude]!);
			const lng = Number.parseFloat(row[indexes.longitude]!);
			const value = Number.parseFloat(row[indexes.value]!);
			if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(value))
				continue;
			points.push({ lat, lng, value });
			valueMin = Math.min(valueMin, value);
			valueMax = Math.max(valueMax, value);
		}
		return {
			dataset: {
				id,
				type: "custom",
				kind: "points",
				name: document.fileName,
				year: 0,
				boundaryType: "ward",
				boundaryYear: 0,
				dataColumn: plan.valueColumn,
				data: {},
				points,
				valueMin: points.length ? valueMin : 0,
				valueMax: points.length ? valueMax : 0,
			},
			report,
		};
	}

	const data: Record<string, number> = {};
	for (const row of rows) {
		let code = row[indexes.code]?.trim();
		const value = Number.parseFloat(row[indexes.value]!);
		if (plan.nameToCode && code)
			code = plan.nameToCode.get(code.toLowerCase()) ?? code;
		if (code && !Number.isNaN(value)) data[code] = value;
	}
	return {
		dataset: {
			id,
			type: "custom",
			kind: "choropleth",
			name: document.fileName,
			year: plan.boundaryYear,
			boundaryType: plan.boundaryType,
			boundaryYear: plan.boundaryYear,
			dataColumn: plan.valueColumn,
			data,
		},
		report,
	};
}
