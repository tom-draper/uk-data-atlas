import { renameSync, rmSync } from "node:fs";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import {
	DatabaseSync,
	type SQLInputValue,
	type StatementSync,
} from "node:sqlite";
import type { Indexed } from "@uk-data-atlas/search-index";

/**
 * Compiled search indexes stored as SQLite tables, read a row at a time.
 *
 * The place and area search indexes are sorted arrays searched by binary
 * search. Parsed from JSON, each worker held them whole: about 270 MB, and
 * half a second to load on the first search. Here each array is a table
 * keyed by position, so the same searches read only the rows they touch.
 */

import { writeSqliteTables, type SqliteTable } from "@uk-data-atlas/artifacts";
export { writeSqliteTables, type SqliteTable } from "@uk-data-atlas/artifacts";

/**
 * Write tables, each keyed by `position`, and a key-value `meta` table. The
 * file is written beside its path and moved into place once complete.
 */
export const writeSqliteIndex = (
	path: string,
	meta: Record<string, string>,
	tables: Record<string, SqliteTable>,
	/** Smaller pages waste less on values that overflow them. */
	pageSize = 4096,
) => {
	const temporary = `${path}.tmp`;
	rmSync(temporary, { force: true });
	const database = new DatabaseSync(temporary);
	try {
		database.exec(
			`PRAGMA foreign_keys = ON; PRAGMA page_size = ${pageSize}; PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; BEGIN;`,
		);
		database.exec(
			"CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID",
		);
		const insertMeta = database.prepare("INSERT INTO meta VALUES (?, ?)");
		for (const [key, value] of Object.entries(meta))
			insertMeta.run(key, value);
		writeSqliteTables(database, tables);
		database.exec("COMMIT; VACUUM;");
	} finally {
		database.close();
	}
	renameSync(temporary, path);
};

/** An index opened for reading. */
export class SqliteIndex {
	private readonly database: DatabaseSync;
	readonly meta: Map<string, string>;

	constructor(
		readonly path: string,
		private readonly prefix = "",
	) {
		this.database = new DatabaseSync(path, { readOnly: true });
		this.meta = new Map(
			(
				this.database
					.prepare(`SELECT key, value FROM ${prefix}meta`)
					.all() as Array<{ key: string; value: string }>
			).map(({ key, value }) => [key, value]),
		);
	}

	/**
	 * Find a row of a keyed table by its key columns, returning one column.
	 */
	lookup(name: string, key: string[], column: string) {
		name = `${this.prefix}${name}`;
		const statement = this.database.prepare(
			`SELECT ${column} AS value FROM ${name} WHERE ${key.map((part) => `${part} = ?`).join(" AND ")}`,
		);
		return (...values: SQLInputValue[]) =>
			(statement.get(...values) as { value: SQLInputValue } | undefined)
				?.value;
	}

	/** A table's rows, read by position. */
	table(name: string) {
		name = `${this.prefix}${name}`;
		const { length } = this.database
			.prepare(`SELECT count(*) AS length FROM ${name}`)
			.get() as { length: number };
		return new SqliteRows(
			this.database.prepare(`SELECT * FROM ${name} WHERE position = ?`),
			this.database.prepare(
				`SELECT * FROM ${name} WHERE position >= ? ORDER BY position LIMIT ${SqliteRows.BLOCK}`,
			),
			this.database.prepare(
				`SELECT * FROM ${name} WHERE position IN (SELECT value FROM json_each(?))`,
			),
			length,
		);
	}
}

export type Row = Record<string, SQLInputValue>;

/**
 * A table's rows by position. A binary search reads one row at a time; once
 * reads run in order, as a prefix scan does, rows are read a block at a time.
 * The rows last read are kept, since a search reads several columns of one
 * row in turn.
 */
export class SqliteRows {
	static readonly BLOCK = 64;
	private start = 0;
	private rows: Row[] = [];
	private last = -2;

	constructor(
		private readonly one: StatementSync,
		private readonly block: StatementSync,
		private readonly many: StatementSync,
		readonly length: number,
	) {}

	/** Rows at several positions, read in one query. */
	getEach(positions: readonly number[]): Array<Row | undefined> {
		const rows = new Map(
			(this.many.all(JSON.stringify(positions)) as Row[]).map((row) => [
				row.position as number,
				row,
			]),
		);
		return positions.map((position) => rows.get(position));
	}

	get(position: number): Row | undefined {
		if (
			!Number.isInteger(position) ||
			position < 0 ||
			position >= this.length
		)
			return undefined;
		const sequential = position === this.last + 1;
		this.last = position;
		const cached = this.rows[position - this.start];
		if (cached) return cached;
		this.start = position;
		this.rows = sequential
			? (this.block.all(position) as Row[])
			: [this.one.get(position) as Row];
		return this.rows[0];
	}

	/** One column, decoded, read as an array. */
	column<T>(
		name: string,
		decode: (value: SQLInputValue) => T,
		offset = 0,
		length = this.length - offset,
	): Indexed<T> {
		return this.records((row) => decode(row[name]!), offset, length);
	}

	/** Whole rows, decoded, read as an array. */
	records<T>(
		decode: (row: Row) => T,
		offset = 0,
		length = this.length - offset,
	): Indexed<T> {
		const inRange = (index: number) => index >= 0 && index < length;
		return {
			length,
			at: (index) => {
				if (!inRange(index)) return undefined;
				const row = this.get(offset + index);
				return row ? decode(row) : undefined;
			},
			atEach: (indexes) =>
				this.getEach(
					indexes.map((index) =>
						Number.isInteger(index) && inRange(index)
							? offset + index
							: -1,
					),
				).map((row) => (row ? decode(row) : undefined)),
		};
	}
}

export const text = (value: SQLInputValue) => value as string;

export const json =
	<T>() =>
	(value: SQLInputValue) =>
		JSON.parse(value as string) as T;

export { packPositions } from "@uk-data-atlas/search-index";

export const unpackPositions = (value: SQLInputValue): number[] => {
	const bytes = value as Uint8Array;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const positions = new Array<number>(bytes.byteLength / 4);
	for (let index = 0; index < positions.length; index += 1)
		positions[index] = view.getUint32(index * 4, true);
	return positions;
};

/**
 * A value as JSON, deflated against a dictionary of text like it. Values read
 * one at a time are too small to compress well alone; a dictionary drawn from
 * their neighbours supplies the repetition a whole file would have.
 */
export const packJson = (value: unknown, dictionary?: Uint8Array) =>
	deflateRawSync(JSON.stringify(value), {
		level: 9,
		...(dictionary ? { dictionary } : {}),
	});

export const unpackJson = <T>(value: SQLInputValue, dictionary?: Uint8Array) =>
	JSON.parse(
		inflateRawSync(
			value as Uint8Array,
			dictionary ? { dictionary } : {},
		).toString("utf8"),
	) as T;

/** The most a deflate dictionary can use. */
const DICTIONARY_BYTES = 32 * 1024;

/** A dictionary for values like these: the JSON of the first, to 32 KB. */
export const jsonDictionary = (values: Iterable<unknown>) => {
	const parts: Buffer[] = [];
	let length = 0;
	for (const value of values) {
		if (length >= DICTIONARY_BYTES) break;
		const part = Buffer.from(JSON.stringify(value));
		parts.push(part);
		length += part.length;
	}
	return Buffer.concat(parts).subarray(0, DICTIONARY_BYTES);
};
