import type { Diagnosis, RowResult } from "./diagnose";
import { statusWord } from "./report";
import type { Successor } from "./successors";
import { freeHeader, writeCsv, type Table } from "./table";

/**
 * Builds the user's file again with each area moved to the latest release:
 * retired codes take their successor, and columns the user asked for are
 * added beside the area column. Every new value is read from the check;
 * a row that cannot be moved keeps what it had and says why.
 */

/** What happens to one row's area in the latest release. */
export type Change =
	| "current"
	| "updated"
	| "split"
	| "no-successor"
	| "not-checked"
	| "not-matched"
	| "empty";

export interface RowUpdate {
	change: Change;
	/** The row's areas in the latest release: one, several for a split, or none. */
	areas: Successor[];
}

/** Add the latest code as a new column, write it over the old one, or leave codes alone. */
export type CodeMode = "add" | "replace" | "keep";
/** A split keeps one row listing its new areas, or becomes one row per area. */
export type SplitMode = "list" | "rows";

/** A parent area column, read from a crosswalk lookup. */
export interface ParentColumn {
	/** Header stem, such as "local_authority". */
	header: string;
	/** Source code to the areas it sits in. */
	lookup: Map<string, Successor[]>;
}

export interface UpdateOptions {
	codes: CodeMode;
	splits: SplitMode;
	/** Add the area's name in the latest release. */
	name: boolean;
	parents: ParentColumn[];
}

const isMatch = (status: RowResult["status"] | undefined) =>
	status === "valid" || status === "matched";

/** Where each row's area is in the latest release, by table row. */
export function rowUpdates(diagnosis: Diagnosis): Map<number, RowUpdate> {
	const byRow = new Map(diagnosis.results.map((r) => [r.row, r]));
	const updates = new Map<number, RowUpdate>();
	for (const result of diagnosis.results)
		updates.set(result.row, rowUpdate(result, byRow, !!diagnosis.latest));
	return updates;
}

function rowUpdate(
	result: RowResult,
	byRow: Map<number, RowResult>,
	hasLatest: boolean,
): RowUpdate {
	if (result.status === "empty") return { change: "empty", areas: [] };
	// No latest status means the matched release is the latest one.
	const status = result.latestStatus ?? result.status;
	const area =
		result.latestStatus !== undefined ? result.latestArea : result.area;
	if (hasLatest && isMatch(status) && area)
		return {
			change: "current",
			areas: [{ code: area.code, name: area.name }],
		};
	if (!hasLatest || status !== "superseded")
		return { change: "not-matched", areas: [] };
	// History is read once per code, so a repeat takes its first row's answer.
	const successors =
		result.successors ??
		(result.duplicateOf !== undefined
			? byRow.get(result.duplicateOf)?.successors
			: undefined);
	if (!successors) return { change: "not-checked", areas: [] };
	if (successors.length === 0) return { change: "no-successor", areas: [] };
	return {
		change: successors.length === 1 ? "updated" : "split",
		areas: successors,
	};
}

/** How many rows each change applies to. */
export function changeCounts(
	updates: Map<number, RowUpdate>,
): Record<Change, number> {
	const counts: Record<Change, number> = {
		current: 0,
		updated: 0,
		split: 0,
		"no-successor": 0,
		"not-checked": 0,
		"not-matched": 0,
		empty: 0,
	};
	for (const update of updates.values()) counts[update.change]++;
	return counts;
}

const joined = (values: string[]) => [...new Set(values)].join(" | ");

function note(update: RowUpdate, result: RowResult | undefined, rows: boolean) {
	switch (update.change) {
		case "current":
			return "current";
		case "updated":
			return "updated";
		case "split":
			return rows
				? "split"
				: `split into ${update.areas.map((a) => a.code).join(", ")}`;
		case "no-successor":
			return "no successor";
		case "not-checked":
			return "history not checked";
		case "empty":
			return "";
		case "not-matched":
			return result ? statusWord(result) : "";
	}
}

/** The user's table with codes moved on and the chosen columns added. */
export function updatedTable(
	table: Table,
	diagnosis: Diagnosis,
	area: number,
	options: UpdateOptions,
): { headers: string[]; rows: string[][] } {
	const byRow = new Map(diagnosis.results.map((r) => [r.row, r]));
	const updates = rowUpdates(diagnosis);
	const isCode = diagnosis.kind === "code";
	const addCode =
		options.codes === "add" || (!isCode && options.codes !== "keep");
	const replace = isCode && options.codes === "replace";

	const taken = [...table.headers];
	const header = (wanted: string) => {
		const free = freeHeader(taken, wanted);
		taken.push(free);
		return free;
	};
	const added: string[] = [];
	if (addCode) added.push(header(isCode ? "latest_code" : "area_code"));
	if (options.name) added.push(header("area_name"));
	for (const parent of options.parents)
		added.push(
			header(`${parent.header}_code`),
			header(`${parent.header}_name`),
		);
	added.push(header("area_update"));

	const cells = (row: string[], index: number, areas: Successor[]) => {
		const update = updates.get(index) ?? { change: "empty", areas: [] };
		const original = row[area] ?? "";
		const out: string[] = [];
		if (addCode) out.push(joined(areas.map((a) => a.code)));
		if (options.name) out.push(joined(areas.map((a) => a.name)));
		for (const parent of options.parents) {
			const within = areas.flatMap(
				(a) => parent.lookup.get(a.code) ?? [],
			);
			out.push(
				joined(within.map((p) => p.code)),
				joined(within.map((p) => p.name)),
			);
		}
		out.push(note(update, byRow.get(index), options.splits === "rows"));
		const cell = replace && areas.length === 1 ? areas[0].code : original;
		return [...row.slice(0, area), cell, ...out, ...row.slice(area + 1)];
	};

	const rows: string[][] = [];
	table.rows.forEach((row, index) => {
		const update = updates.get(index);
		const areas = update?.areas ?? [];
		if (update?.change === "split" && options.splits === "rows")
			for (const each of areas) rows.push(cells(row, index, [each]));
		else rows.push(cells(row, index, areas));
	});

	return {
		headers: [
			...table.headers.slice(0, area + 1),
			...added,
			...table.headers.slice(area + 1),
		],
		rows,
	};
}

export function updatedCsv(
	table: Table,
	diagnosis: Diagnosis,
	area: number,
	options: UpdateOptions,
): string {
	const { headers, rows } = updatedTable(table, diagnosis, area, options);
	return writeCsv(headers, rows);
}
