/** What the readers and writers share: cell values as text, and back. */

export interface Sheet {
	name: string;
	/** Every row, each cell as text. Trailing blank cells and rows are cut. */
	rows: string[][];
	/** Rows beyond the read limit that were left out. */
	extraRows: number;
	hidden: boolean;
}

export interface Workbook {
	format: "xlsx" | "ods";
	sheets: Sheet[];
}

/** A number as a cell would show it, without float noise like 0.1 + 0.2. */
export function numberText(raw: string): string {
	const value = Number(raw);
	if (!Number.isFinite(value)) return raw.trim();
	return String(Number(value.toPrecision(15)));
}

/** A cell that is exactly a number in its plainest form, so it can be a number cell. */
export function plainNumber(value: string): number | null {
	if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return null;
	const number = Number(value);
	// Past 15 digits a spreadsheet would round it.
	return Number.isFinite(number) && value.replace(/[-.]/g, "").length <= 15
		? number
		: null;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/** A cell that is an ISO date or date and time, as a spreadsheet serial. */
export function isoSerial(
	value: string,
): { serial: number; time: boolean } | null {
	const match = DATE.exec(value);
	if (!match) return null;
	const [, y, m, d, hh, mm, ss] = match;
	const year = Number(y);
	const month = Number(m);
	const day = Number(d);
	const date = new Date(Date.UTC(year, month - 1, day));
	if (
		year < 1900 ||
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	)
		return null;
	const hours = Number(hh ?? 0);
	const minutes = Number(mm ?? 0);
	const seconds = Number(ss ?? 0);
	if (hours > 23 || minutes > 59 || seconds > 59) return null;
	const days = Date.UTC(year, month - 1, day) / 86_400_000 + 25_569;
	const fraction = (hours * 3600 + minutes * 60 + seconds) / 86_400;
	return { serial: days + fraction, time: hh !== undefined };
}

const pad = (value: number, size = 2) => String(value).padStart(size, "0");

/** A spreadsheet serial as ISO text: a date, a date and time, or just a time. */
export function serialText(serial: number, date1904: boolean): string {
	const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
	const totalSeconds = Math.round(serial * 86_400);
	const days = Math.floor(totalSeconds / 86_400);
	const seconds = totalSeconds - days * 86_400;
	const time = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
	if (serial >= 0 && serial < 1) return time;
	const date = new Date(epoch + days * 86_400_000);
	const day = `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
	return seconds === 0 ? day : `${day}T${time}`;
}

/** Cuts blank cells off the end of a row. */
export function trimRow(row: string[]): string[] {
	let end = row.length;
	while (end > 0 && row[end - 1] === "") end--;
	return end === row.length ? row : row.slice(0, end);
}

/** Cuts blank rows off the end of a sheet. */
export function trimRows(rows: string[][]): string[][] {
	let end = rows.length;
	while (end > 0 && rows[end - 1].every((cell) => cell.trim() === "")) end--;
	rows.length = end;
	return rows;
}

/** XML text with the characters it may not hold taken out. */
export function xmlText(value: string): string {
	return value
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

export const xmlAttribute = (value: string) =>
	xmlText(value).replace(/"/g, "&quot;");

/** The letters of a zero-based column: 0 is A, 26 is AA. */
export function columnLetters(index: number): string {
	let letters = "";
	for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
		letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
	return letters;
}

/** The zero-based column of a cell reference such as "BC12". */
export function columnIndex(reference: string): number {
	let index = 0;
	for (let i = 0; i < reference.length; i++) {
		const code = reference.charCodeAt(i);
		if (code < 65 || code > 90) {
			if (code >= 97 && code <= 122) {
				index = index * 26 + (code - 96);
				continue;
			}
			break;
		}
		index = index * 26 + (code - 64);
	}
	return index - 1;
}
