import { renameSync, rmSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
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
			length,
		);
	}
}

type Row = Record<string, SQLInputValue>;

/**
 * A table's rows by position. The last row read is kept, since a search reads
 * several columns of one row in turn.
 */
export class SqliteRows {
	private cached = -1;
	private row: Row | undefined;

	constructor(
		private readonly statement: ReturnType<DatabaseSync["prepare"]>,
		readonly length: number,
	) {}

	get(position: number): Row | undefined {
		if (position !== this.cached) {
			this.row =
				Number.isInteger(position) &&
				position >= 0 &&
				position < this.length
					? (this.statement.get(position) as Row)
					: undefined;
			this.cached = position;
		}
		return this.row;
	}

	/** One column, decoded, read as an array. */
	column<T>(
		name: string,
		decode: (value: SQLInputValue) => T,
		offset = 0,
		length = this.length - offset,
	): Indexed<T> {
		return {
			length,
			at: (index) => {
				if (index < 0 || index >= length) return undefined;
				const row = this.get(offset + index);
				return row ? decode(row[name]!) : undefined;
			},
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
