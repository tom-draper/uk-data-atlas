import { guessParentColumn } from "@/lib/data/custom/columns";
import type { Table } from "./table";

/**
 * Works out which column holds areas and which hold numbers, from the values
 * themselves. Headers only break ties, so a column called "id" full of GSS
 * codes is still found.
 */

/** A GSS code: a letter and eight digits, such as E05013408. */
export const GSS_CODE = /^[A-Za-z]\d{8}$/;
/** Shaped like a code but maybe mistyped: a letter and some digits. */
const CODE_LIKE = /^[A-Za-z]\d{4,12}$/;
const NUMBER = /^[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?$/;
const NAME_HEADER =
	/name|area|place|ward|authority|council|district|borough|constituency|county|region|lsoa|msoa/i;
const NOT_A_VALUE_HEADER =
	/^(year|yr|period|date|month|quarter|id|row|index)$/i;

/** Least share of filled cells that must look like codes or numbers. */
const CODE_SHARE = 0.6;
const NUMBER_SHARE = 0.9;

export interface ColumnProfile {
	index: number;
	header: string;
	filled: number;
	codeShare: number;
	numberShare: number;
	textShare: number;
}

export interface Detection {
	/** The column holding area codes or names, or null if none was found. */
	area: number | null;
	kind: "code" | "name" | null;
	/** A column of parent names or codes that settles shared names. */
	parent: number | null;
	/** Numeric columns, in table order. */
	values: number[];
}

/** Reads "1,234", "12.5" or "-3" as numbers; anything else is not one. */
export function parseNumber(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed || !NUMBER.test(trimmed) || !/\d/.test(trimmed)) return null;
	const number = Number(trimmed.replace(/,/g, ""));
	return Number.isFinite(number) ? number : null;
}

export function profileColumns(table: Table): ColumnProfile[] {
	return table.headers.map((header, index) => {
		let filled = 0;
		let codes = 0;
		let numbers = 0;
		let text = 0;
		for (const row of table.rows) {
			const value = row[index]?.trim() ?? "";
			if (!value) continue;
			filled++;
			if (CODE_LIKE.test(value)) codes++;
			else if (parseNumber(value) !== null) numbers++;
			else if (/[A-Za-z]/.test(value)) text++;
		}
		const share = (count: number) => (filled ? count / filled : 0);
		return {
			index,
			header,
			filled,
			codeShare: share(codes),
			numberShare: share(numbers),
			textShare: share(text),
		};
	});
}

export function detectColumns(table: Table): Detection {
	const profiles = profileColumns(table);

	const codeColumn = profiles
		.filter((column) => column.codeShare >= CODE_SHARE)
		.sort(
			(a, b) =>
				b.codeShare - a.codeShare ||
				Number(NAME_HEADER.test(b.header)) -
					Number(NAME_HEADER.test(a.header)),
		)[0];

	const textColumns = profiles.filter(
		(column) => column.textShare >= 0.8 && column.filled > 0,
	);
	const nameColumn =
		textColumns.find((column) => NAME_HEADER.test(column.header)) ??
		textColumns[0];

	const area = codeColumn ?? nameColumn ?? null;
	const kind = codeColumn ? "code" : nameColumn ? "name" : null;

	const parentHeader =
		kind === "name" && area
			? guessParentColumn(table.headers, area.header)
			: undefined;
	const parent = parentHeader ? table.headers.indexOf(parentHeader) : -1;

	const values = profiles
		.filter(
			(column) =>
				column.index !== area?.index &&
				column.filled > 0 &&
				column.numberShare >= NUMBER_SHARE &&
				!NOT_A_VALUE_HEADER.test(column.header.trim()),
		)
		.map((column) => column.index);

	return {
		area: area?.index ?? null,
		kind,
		parent: parent >= 0 ? parent : null,
		values,
	};
}

/** Whether a column, once chosen, holds codes rather than names. */
export function columnKind(table: Table, index: number): "code" | "name" {
	const profile = profileColumns(table)[index];
	return profile && profile.codeShare >= CODE_SHARE ? "code" : "name";
}
