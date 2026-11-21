import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { csvRecords } from "@uk-data-atlas/artifacts";
import { sourceDir } from "@uk-data-atlas/datasets";
import type { ChangeKind } from "./areaChangeClassifier.ts";

/**
 * Legal effective dates of area changes, from the ONS Code History Database
 * (see `sources/fetch-ons-code-history.ts`). A release edition says only that
 * a change had happened by then. The database says on which day it took legal
 * effect, so an event that can be matched to it is dated by that day.
 */
export const CODE_HISTORY_DIRECTORY = "code-history/2026-06-uk";
export const CODE_HISTORY_CHANGES_FILE = "changes.csv";
export const CODE_HISTORY_CODES_FILE = "codes.csv";

export type LegalDates = {
	/** Operative dates by `predecessor|successor`. */
	changes: ReadonlyMap<string, readonly string[]>;
	/** The first date each code was in use. */
	introduced: ReadonlyMap<string, string>;
	/** The last date each code was in use, for codes that have ended. */
	terminated: ReadonlyMap<string, string>;
};

/** The part of an event that dating needs. */
export type DatableChange = {
	kind: ChangeKind;
	fromCodes: readonly string[];
	toCodes: readonly string[];
	/** Edition date of the earlier release. */
	fromEdition: string;
	/** Edition date of the later release. */
	toEdition: string;
};

/** How an event's legal date was found, or why it was not. */
export type LegalDateMatch =
	| { date: string; via: "change" | "introduced" | "terminated" }
	| { date: null; via: "none" | "out-of-window" | "not-dated" };

export function parseLegalDates(
	changesCsv: string,
	codesCsv: string,
): LegalDates {
	const changes = new Map<string, string[]>();
	const [, ...changeRows] = csvRecords(changesCsv);
	for (const [predecessor, successor, date] of changeRows) {
		if (!predecessor || !successor || !date) continue;
		const key = `${predecessor}|${successor}`;
		const held = changes.get(key);
		if (!held) changes.set(key, [date]);
		else if (!held.includes(date)) held.push(date);
	}
	const introduced = new Map<string, string>();
	const terminated = new Map<string, string>();
	const [, ...codeRows] = csvRecords(codesCsv);
	for (const [code, start, end] of codeRows) {
		if (!code) continue;
		if (start) introduced.set(code, start);
		if (end) terminated.set(code, end);
	}
	return { changes, introduced, terminated };
}

/** Reads the extracted source, or nothing when it has not been fetched. */
export function readLegalDates(root: string): LegalDates | undefined {
	const directory = join(
		root,
		"data/source",
		sourceDir("lookups", CODE_HISTORY_DIRECTORY),
	);
	const changes = join(directory, CODE_HISTORY_CHANGES_FILE);
	const codes = join(directory, CODE_HISTORY_CODES_FILE);
	if (!existsSync(changes) || !existsSync(codes)) return undefined;
	return parseLegalDates(
		readFileSync(changes, "utf8"),
		readFileSync(codes, "utf8"),
	);
}

/** The last day of the month an edition date falls in. */
export const endOfMonth = (date: string) => {
	const [year, month] = date.split("-").map(Number);
	return new Date(Date.UTC(year!, month!, 0)).toISOString().slice(0, 10);
};

/**
 * The legal date of one event, in order of preference:
 *
 * 1. an operative date of a predecessor and successor pair that the event
 *    links (a rename, split, merge or redistribution, and any recode the
 *    database records);
 * 2. for a `created` event, the date its code came into use, and for an
 *    `ended` event, the date its code went out of use.
 *
 * A date counts only if it lies in the interval the two editions bound: on or
 * after the earlier edition's date and by the end of the later edition's
 * month. This excludes the 1 January 2009 dates the database gives to codes
 * that were recoded in bulk, and any date that belongs to another change of
 * the same code. Where several dates remain, the earliest is used. Renamed
 * and redrawn events have no operative date to match and keep their edition
 * date, as does any event with no match.
 */
export function matchLegalDate(
	change: DatableChange,
	dates: LegalDates,
): LegalDateMatch {
	if (change.kind === "renamed" || change.kind === "redrawn")
		return { date: null, via: "not-dated" };
	const latest = endOfMonth(change.toEdition);
	const inWindow = (date: string) =>
		date >= change.fromEdition && date <= latest;
	let seen = false;
	const earliest = (candidates: Iterable<string | undefined>) => {
		const found = [...candidates].filter(
			(date): date is string => date !== undefined,
		);
		if (found.length) seen = true;
		return found.filter(inWindow).sort()[0];
	};
	const pair = earliest(
		change.fromCodes.flatMap((from) =>
			change.toCodes.flatMap(
				(to) => dates.changes.get(`${from}|${to}`) ?? [],
			),
		),
	);
	if (pair) return { date: pair, via: "change" };
	if (change.kind === "created") {
		const date = earliest(
			change.toCodes.map((code) => dates.introduced.get(code)),
		);
		if (date) return { date, via: "introduced" };
	}
	if (change.kind === "ended") {
		const date = earliest(
			change.fromCodes.map((code) => dates.terminated.get(code)),
		);
		if (date) return { date, via: "terminated" };
	}
	return { date: null, via: seen ? "out-of-window" : "none" };
}
