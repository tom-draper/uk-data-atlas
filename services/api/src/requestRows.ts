import { csvFields } from "./populationOverlap";
import { problem, type ApiResponse } from "./routeResponse";
import type { RequestBody } from "./routing";

/**
 * Rows a caller sends in a POST body: a column of area codes or names, and
 * for a join the value each one carries. JSON and CSV say the same thing, so
 * both are read into one shape; nothing in a row is corrected or guessed.
 */

/** The most rows one body may carry: more than any one release holds. */
export const MAX_POSTED_ROWS = 250_000;

export type RowValue = number | string | boolean | null;

export type PostedRows = {
	areas: string[];
	/** One per area, in the same order, when the caller sent any. */
	parents?: string[];
	/** One per area, in the same order, when values were asked for. */
	values?: RowValue[];
};

// The column naming the area may be called any of these, since a caller's
// spreadsheet already has one of them; the first present is read.
const AREA_COLUMNS = ["area", "code", "name"] as const;

const invalid = (detail: string): ApiResponse =>
	problem(400, "Invalid Body", detail);

const mediaType = (contentType: string) =>
	contentType.split(";", 1)[0]!.trim().toLowerCase();

/** A CSV cell as a value: a number where it reads as one, empty as null. */
const csvValue = (cell: string): RowValue => {
	const trimmed = cell.trim();
	if (trimmed === "") return null;
	const number = Number(trimmed);
	return Number.isFinite(number) ? number : cell;
};

const isRowValue = (value: unknown): value is RowValue =>
	value === null ||
	typeof value === "boolean" ||
	typeof value === "string" ||
	(typeof value === "number" && Number.isFinite(value));

const readCsv = (
	text: string,
	withValues: boolean,
): PostedRows | ApiResponse => {
	const lines = text
		.replace(/^﻿/, "")
		.split(/\r?\n/)
		.filter((line) => line.trim().length > 0);
	const header = csvFields(lines[0] ?? "").map((name) =>
		name.trim().toLowerCase(),
	);
	const areaColumn = [...AREA_COLUMNS, ...(withValues ? [] : ["value"])]
		.map((name) => header.indexOf(name))
		.find((index) => index !== -1);
	if (areaColumn === undefined)
		return invalid(
			`The CSV header must name the area column as ${withValues ? "area, code or name" : "area, code, name or value"}; it has ${header.join(", ") || "no columns"}.`,
		);
	const valueColumn = withValues ? header.indexOf("value") : -1;
	if (withValues && (valueColumn === -1 || valueColumn === areaColumn))
		return invalid("The CSV header must name a value column.");
	const parentColumn = header.indexOf("parent");
	const rows = lines.slice(1).map(csvFields);
	return {
		areas: rows.map((row) => row[areaColumn] ?? ""),
		...(parentColumn !== -1
			? { parents: rows.map((row) => row[parentColumn] ?? "") }
			: {}),
		...(withValues
			? { values: rows.map((row) => csvValue(row[valueColumn] ?? "")) }
			: {}),
	};
};

const readJson = (
	text: string,
	withValues: boolean,
): PostedRows | ApiResponse => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return invalid("The body is not valid JSON.");
	}
	const object =
		typeof parsed === "object" && parsed !== null
			? (parsed as Record<string, unknown>)
			: {};
	// A list of values mirrors the repeated value= a GET takes.
	if (!withValues && Array.isArray(object.values)) {
		const { values, parents } = object;
		if (!values.every((value) => typeof value === "string"))
			return invalid("values must be an array of strings.");
		if (
			parents !== undefined &&
			(!Array.isArray(parents) ||
				!parents.every((parent) => typeof parent === "string"))
		)
			return invalid("parents, when sent, must be an array of strings.");
		return {
			areas: values as string[],
			...(parents ? { parents: parents as string[] } : {}),
		};
	}
	if (!Array.isArray(object.rows))
		return invalid(
			withValues
				? 'Send {"rows": [{"area": "E05000650", "value": 12}]}, or CSV with area and value columns.'
				: 'Send {"values": ["E05000650", "Bristol"]}, {"rows": [{"area": "E05000650"}]}, or CSV with an area column.',
		);
	const areas: string[] = [];
	const parents: string[] = [];
	const values: RowValue[] = [];
	let anyParent = false;
	for (const [index, row] of object.rows.entries()) {
		if (typeof row !== "object" || row === null)
			return invalid(`rows[${index}] is not an object.`);
		const fields = row as Record<string, unknown>;
		const key = AREA_COLUMNS.find((name) => name in fields);
		const area = key === undefined ? undefined : fields[key];
		if (typeof area !== "string")
			return invalid(
				`rows[${index}] needs its area as a string, under area, code or name.`,
			);
		if (withValues && !isRowValue(fields.value))
			return invalid(
				`rows[${index}].value must be a number, string, boolean or null.`,
			);
		if (fields.parent !== undefined && typeof fields.parent !== "string")
			return invalid(
				`rows[${index}].parent, when sent, must be a string.`,
			);
		areas.push(area);
		parents.push((fields.parent as string | undefined) ?? "");
		anyParent ||= fields.parent !== undefined;
		if (withValues) values.push(fields.value as RowValue);
	}
	return {
		areas,
		...(anyParent ? { parents } : {}),
		...(withValues ? { values } : {}),
	};
};

/** The rows a body carries, or the reason it cannot be read. */
export const readPostedRows = (
	body: RequestBody | undefined,
	options: { withValues: boolean },
): PostedRows | ApiResponse => {
	const type = mediaType(body?.contentType ?? "");
	const read =
		type === "application/json" || type.endsWith("+json")
			? readJson(body!.text, options.withValues)
			: type === "text/csv"
				? readCsv(body!.text, options.withValues)
				: problem(
						415,
						"Unsupported Media Type",
						"Send the rows as application/json or text/csv.",
					);
	if ("status" in read) return read;
	if (read.areas.length === 0) return invalid("The body holds no rows.");
	if (read.areas.length > MAX_POSTED_ROWS)
		return problem(
			413,
			"Content Too Large",
			`At most ${MAX_POSTED_ROWS} rows are read from one body; this one has ${read.areas.length}.`,
		);
	return read;
};
