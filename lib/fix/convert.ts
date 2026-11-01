import { parseNumber } from "./detect";
import type { Diagnosis } from "./diagnose";
import {
	compareReleasesNewestFirst,
	geographyLabel,
	releaseLabel,
	sameRelease,
} from "./releases";
import { freeHeader, writeCsv, type Table } from "./table";
import type {
	BoundaryRelease,
	ConvertedCounts,
	Crosswalk,
	ReleaseRef,
} from "./types";

/**
 * Moves a table's counts onto another geography through the API's
 * `/crosswalks/{id}:convert`. The API refuses a whole request for one bad
 * row, so only rows the check matched are sent, and the rest are listed.
 * Every number in the result comes from the API; none is computed here.
 */

export interface ConvertChoice {
	/** The crosswalk id. */
	id: string;
	to: ReleaseRef;
	label: string;
	/** Header stem, such as "local_authority". */
	header: string;
	/** Weights the API needs opting in to, for crosswalks that split areas. */
	weighting?: "area" | "population";
}

const snake = (geography: string) =>
	geography.replace(/([a-z\d])([A-Z])/g, "$1_$2").toLowerCase();

/**
 * The geographies a release's counts can be converted to. Best-fit
 * crosswalks are left out, since the API will not convert counts through
 * them, and so are crosswalks to the same geography.
 */
export function convertChoices(
	from: ReleaseRef,
	crosswalks: Crosswalk[],
	releases: BoundaryRelease[],
): ConvertChoice[] {
	const usable = crosswalks
		.filter(
			(crosswalk) =>
				sameRelease(crosswalk.from, from) &&
				crosswalk.to.geography !== from.geography &&
				crosswalk.method !== "best-fit",
		)
		.sort(
			(a, b) =>
				geographyLabel(releases, a.to.geography).localeCompare(
					geographyLabel(releases, b.to.geography),
				) ||
				compareReleasesNewestFirst(
					a.to.boundaryRelease,
					b.to.boundaryRelease,
				) ||
				a.id.localeCompare(b.id),
		);
	return usable.map((crosswalk) => {
		const basis = crosswalk.weighting?.basis;
		// One target release can have an exact crosswalk and a weighted one.
		const twin = usable.some(
			(other) =>
				other !== crosswalk && sameRelease(other.to, crosswalk.to),
		);
		const label = releaseLabel(releases, crosswalk.to);
		return {
			id: crosswalk.id,
			to: crosswalk.to,
			label: twin && basis ? `${label}, split by ${basis}` : label,
			header: snake(crosswalk.to.geography),
			weighting: basis,
		};
	});
}

export interface CountRow {
	code: string;
	value: number;
}

export interface LeftOut {
	/** 1-based line in the user's file, counting the header as line 1. */
	line: number;
	value: string;
	reason: string;
}

export interface CountInput {
	rows: CountRow[];
	leftOut: LeftOut[];
	/** Lines that repeat an area already sent, which the API refuses. */
	repeats: LeftOut[];
}

/**
 * One column's counts, keyed by each matched row's code in the matched
 * release. Rows with no match, or with a cell that is not a count, are left
 * out rather than guessed at.
 */
export function countInput(
	table: Table,
	diagnosis: Diagnosis,
	column: number,
): CountInput {
	const rows: CountRow[] = [];
	const leftOut: LeftOut[] = [];
	const repeats: LeftOut[] = [];
	const lineOf = new Map<string, number>();
	const results = [...diagnosis.results].sort((a, b) => a.row - b.row);
	for (const result of results) {
		const line = result.row + 2;
		const cell = table.rows[result.row]?.[column] ?? "";
		const matched =
			(result.status === "valid" || result.status === "matched") &&
			result.area;
		if (!matched) {
			if (result.status !== "empty" || cell.trim())
				leftOut.push({
					line,
					value: result.value,
					reason:
						result.status === "empty"
							? "no area"
							: "area not matched",
				});
			continue;
		}
		const number = parseNumber(cell);
		if (number === null || number < 0) {
			leftOut.push({
				line,
				value: result.value,
				reason: cell.trim() ? "not a count" : "no value",
			});
			continue;
		}
		const code = result.area!.code;
		const first = lineOf.get(code);
		if (first !== undefined) {
			repeats.push({
				line,
				value: result.value,
				reason: `same area as line ${first}`,
			});
			continue;
		}
		lineOf.set(code, line);
		rows.push({ code, value: number });
	}
	return { rows, leftOut, repeats };
}

export interface ConvertedColumn {
	/** The user's column header. */
	header: string;
	result: ConvertedCounts;
}

/** "complete", or "partial: 26 of 98 wards" when some areas inside were not sent. */
function coverageNote(
	record: ConvertedCounts["records"][number],
	sourceNoun: string,
) {
	const { status, sourceCount, suppliedSourceCount } = record.coverage;
	if (status === "complete") return "complete";
	return `partial: ${suppliedSourceCount.toLocaleString("en-GB")} of ${sourceCount.toLocaleString("en-GB")} ${sourceNoun}`;
}

/**
 * One row per target area reached by any column, with each column's
 * converted value and how much of the area it covers. Areas a column did
 * not reach are left blank, never zero.
 */
export function convertedTable(
	columns: ConvertedColumn[],
	header: string,
	names: Map<string, string>,
	sourceNoun: string,
): { headers: string[]; rows: string[][] } {
	const taken: string[] = [];
	const take = (wanted: string) => {
		const free = freeHeader(taken, wanted);
		taken.push(free);
		return free;
	};
	const headers = [take(`${header}_code`), take(`${header}_name`)];
	for (const column of columns)
		headers.push(take(column.header), take(`${column.header}_coverage`));

	const byCode = columns.map(
		(column) =>
			new Map(
				column.result.records.map((record) => [
					record.areaCode,
					record,
				]),
			),
	);
	const codes = [
		...new Set(
			columns.flatMap((column) =>
				column.result.records.map((record) => record.areaCode),
			),
		),
	].sort();
	const rows = codes.map((code) => [
		code,
		names.get(code) ?? "",
		...byCode.flatMap((records) => {
			const record = records.get(code);
			return record
				? [String(record.value), coverageNote(record, sourceNoun)]
				: ["", ""];
		}),
	]);
	return { headers, rows };
}

export function convertedCsv(
	...args: Parameters<typeof convertedTable>
): string {
	const { headers, rows } = convertedTable(...args);
	return writeCsv(headers, rows);
}
