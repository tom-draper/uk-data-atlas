import { renameSync, rmSync } from "node:fs";
import {
	DatabaseSync,
	type SQLInputValue,
	type StatementSync,
} from "node:sqlite";
import type { Indexed } from "./sortedIndex";

/**
 * Compiled search indexes stored as SQLite tables, read a row at a time.
 *
 * The place and area search indexes are sorted arrays searched by binary
 * search. Parsed from JSON, each worker held them whole: about 270 MB, and
 * half a second to load on the first search. Here each array is a table
 * keyed by position, so the same searches read only the rows they touch.
 */

export type SqliteTable = {
	columns: string[];
	/** One row per position, in order. */
	rows: Iterable<SQLInputValue[]>;
};

/**
 * Write tables, each keyed by `position`, and a key-value `meta` table. The
 * file is written beside its path and moved into place once complete.
 */
export const writeSqliteIndex = (
	path: string,
	meta: Record<string, string>,
	tables: Record<string, SqliteTable>,
) => {
	const temporary = `${path}.tmp`;
	rmSync(temporary, { force: true });
	const database = new DatabaseSync(temporary);
	try {
		database.exec(
			"PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; BEGIN;",
		);
		database.exec(
			"CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID",
		);
		const insertMeta = database.prepare("INSERT INTO meta VALUES (?, ?)");
		for (const [key, value] of Object.entries(meta))
			insertMeta.run(key, value);
		for (const [name, table] of Object.entries(tables)) {
			database.exec(
				`CREATE TABLE ${name} (position INTEGER PRIMARY KEY, ${table.columns.join(", ")})`,
			);
			const insert = database.prepare(
				`INSERT INTO ${name} VALUES (${["?", ...table.columns.map(() => "?")].join(", ")})`,
			);
			let position = 0;
			for (const row of table.rows) insert.run(position++, ...row);
		}
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

	constructor(readonly path: string) {
		this.database = new DatabaseSync(path, { readOnly: true });
		this.meta = new Map(
			(
				this.database
					.prepare("SELECT key, value FROM meta")
					.all() as Array<{ key: string; value: string }>
			).map(({ key, value }) => [key, value]),
		);
	}

	/** A table's rows, read by position. */
	table(name: string) {
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

type Row = Record<string, SQLInputValue>;

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
		const inRange = (index: number) => index >= 0 && index < length;
		return {
			length,
			at: (index) => {
				if (!inRange(index)) return undefined;
				const row = this.get(offset + index);
				return row ? decode(row[name]!) : undefined;
			},
			atEach: (indexes) =>
				this.getEach(
					indexes.map((index) =>
						Number.isInteger(index) && inRange(index)
							? offset + index
							: -1,
					),
				).map((row) => (row ? decode(row[name]!) : undefined)),
		};
	}
}

export const text = (value: SQLInputValue) => value as string;

export const json =
	<T>() =>
	(value: SQLInputValue) =>
		JSON.parse(value as string) as T;

/** Ascending positions, packed as little-endian u32s. */
export const packPositions = (positions: readonly number[]) => {
	const bytes = new Uint8Array(positions.length * 4);
	const view = new DataView(bytes.buffer);
	positions.forEach((position, index) =>
		view.setUint32(index * 4, position, true),
	);
	return bytes;
};

export const unpackPositions = (value: SQLInputValue): number[] => {
	const bytes = value as Uint8Array;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const positions = new Array<number>(bytes.byteLength / 4);
	for (let index = 0; index < positions.length; index += 1)
		positions[index] = view.getUint32(index * 4, true);
	return positions;
};
