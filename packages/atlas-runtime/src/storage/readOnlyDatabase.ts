import { statSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";

/**
 * One read-only connection per database file per process, with prepared
 * statements kept per SQL string.
 *
 * The pipeline replaces `atlas.sqlite` and `atlas-cache.sqlite` by renaming a
 * temporary file over them, and a connection keeps reading the inode it
 * opened. So before a connection is handed out, the file's identity (`dev`,
 * `ino`, `size`, `mtime`) is compared with the one recorded at open. A changed
 * file closes the old connection, drops its statements and opens the new one
 * under a new generation. The stat is throttled to once per `recheckMs`.
 *
 * Callers lease a connection for one read and release it afterwards. A file
 * replaced during a lease is retired, and closed once its last lease is
 * released, so a read in flight never loses its connection.
 *
 * State lives on `globalThis`, so bundlers that load this module more than
 * once (Next.js route bundles, hot reload) still share one set of connections.
 */

/** How long a connection is trusted before the file is checked again. */
const DEFAULT_RECHECK_MS = 1000;
/** Prepared statements kept per connection, least recently used out first. */
const MAX_STATEMENTS = 256;

type Identity = {
	dev: bigint;
	ino: bigint;
	size: bigint;
	mtimeNs: bigint;
};

type Entry = {
	readonly path: string;
	readonly generation: number;
	readonly database: DatabaseSync;
	readonly statements: Map<string, StatementSync>;
	identity: Identity;
	checkedAt: number;
	leases: number;
	retired: boolean;
	closed: boolean;
};

type Registry = {
	entries: Map<string, Entry>;
	/** Entries replaced while leased, closed when their last lease ends. */
	retired: Set<Entry>;
	listeners: Set<(path: string) => void>;
	nextGeneration: number;
	recheckMs: number;
	now: () => number;
	exitHook: boolean;
};

const REGISTRY_KEY = Symbol.for("uk-data-atlas.readOnlyDatabases.v1");

const registry = (): Registry => {
	const shared = globalThis as { [REGISTRY_KEY]?: Registry };
	return (shared[REGISTRY_KEY] ??= {
		entries: new Map(),
		retired: new Set(),
		listeners: new Set(),
		nextGeneration: 1,
		recheckMs: recheckFromEnvironment(),
		now: () => performance.now(),
		exitHook: false,
	});
};

function recheckFromEnvironment() {
	const value = Number(process.env.ATLAS_SQLITE_RECHECK_MS);
	return process.env.ATLAS_SQLITE_RECHECK_MS?.trim() &&
		Number.isFinite(value) &&
		value >= 0
		? value
		: DEFAULT_RECHECK_MS;
}

/** A leased connection. Call `release` when the read is done. */
export type ReadOnlyDatabase = {
	readonly path: string;
	/** Changes whenever the file is reopened, so cached reads can be dropped. */
	readonly generation: number;
	/** A prepared statement, reused for the same SQL on this connection. */
	prepare(sql: string): StatementSync;
	release(): void;
};

/** What helpers that only read need from a database. */
export type SqlReader = Pick<DatabaseSync, "prepare">;

/** The file's identity, or undefined where it cannot be read. */
const identityOf = (path: string): Identity | undefined => {
	const stats = statSync(path, { bigint: true, throwIfNoEntry: false });
	if (!stats) return undefined;
	return {
		dev: stats.dev,
		ino: stats.ino,
		size: stats.size,
		mtimeNs: stats.mtimeNs,
	};
};

const sameFile = (left: Identity, right: Identity | undefined) =>
	right !== undefined &&
	left.dev === right.dev &&
	left.ino === right.ino &&
	left.size === right.size &&
	left.mtimeNs === right.mtimeNs;

const closeEntry = (state: Registry, entry: Entry) => {
	if (entry.closed) return;
	entry.closed = true;
	entry.statements.clear();
	state.retired.delete(entry);
	try {
		entry.database.close();
	} catch {
		// Already closed.
	}
};

const retire = (state: Registry, entry: Entry) => {
	entry.retired = true;
	if (state.entries.get(entry.path) === entry)
		state.entries.delete(entry.path);
	if (entry.leases === 0) closeEntry(state, entry);
	else state.retired.add(entry);
};

function open(state: Registry, path: string): Entry {
	// Record the identity before opening: a file replaced in between is then
	// found on the next check and reopened, never served as the old one.
	const identity = identityOf(path);
	// Connection pragmas, if any are wanted, belong here and nowhere else.
	const database = new DatabaseSync(path, { readOnly: true });
	if (!identity) {
		database.close();
		throw new Error(`Cannot read the identity of ${path}`);
	}
	const entry: Entry = {
		path,
		generation: state.nextGeneration++,
		database,
		statements: new Map(),
		identity,
		checkedAt: state.now(),
		leases: 0,
		retired: false,
		closed: false,
	};
	state.entries.set(path, entry);
	if (!state.exitHook) {
		state.exitHook = true;
		process.once("exit", closeAllReadOnlyDatabases);
	}
	return entry;
}

function current(state: Registry, path: string, fresh: boolean): Entry {
	let entry = state.entries.get(path);
	let replaced = false;
	if (entry) {
		const now = state.now();
		if (fresh || now - entry.checkedAt >= state.recheckMs) {
			if (sameFile(entry.identity, identityOf(path))) {
				entry.checkedAt = now;
			} else {
				retire(state, entry);
				entry = undefined;
				replaced = true;
			}
		}
	}
	if (!entry) {
		try {
			entry = open(state, path);
		} catch (error) {
			if (replaced) notify(state, path);
			throw error;
		}
	}
	if (replaced) notify(state, path);
	return entry;
}

const notify = (state: Registry, path: string) => {
	for (const listener of [...state.listeners]) listener(path);
};

/**
 * Lease the shared read-only connection for `path`, reopening it first if
 * the file was replaced. Release the lease in a `finally`. `fresh` checks the
 * file now, whatever the interval, for readers that compare two reads.
 */
export function openReadOnlyDatabase(
	path: string,
	options: { fresh?: boolean } = {},
): ReadOnlyDatabase {
	const state = registry();
	const entry = current(state, resolve(path), options.fresh === true);
	entry.leases += 1;
	let released = false;
	return {
		path: entry.path,
		generation: entry.generation,
		prepare(sql) {
			let statement = entry.statements.get(sql);
			if (statement) {
				// Most recently used last.
				entry.statements.delete(sql);
			} else {
				statement = entry.database.prepare(sql);
				if (entry.statements.size >= MAX_STATEMENTS) {
					const oldest = entry.statements.keys().next().value;
					if (oldest !== undefined) entry.statements.delete(oldest);
				}
			}
			entry.statements.set(sql, statement);
			return statement;
		},
		release() {
			if (released) return;
			released = true;
			entry.leases -= 1;
			if (entry.retired && entry.leases === 0) closeEntry(state, entry);
		},
	};
}

/**
 * The generation of the file's current connection, after the usual check for
 * a replacement. Anything derived from the file's contents is valid for one
 * generation.
 */
export function databaseGeneration(path: string): number {
	const database = openReadOnlyDatabase(path);
	try {
		return database.generation;
	} finally {
		database.release();
	}
}

/**
 * A value computed from database files, recomputed after any of them is
 * replaced. A computation that throws is not kept.
 */
export function memoByGeneration<T>(
	paths: readonly string[],
	compute: () => T,
): () => T {
	let kept: { key: string; value: T } | undefined;
	return () => {
		const key = paths.map(databaseGeneration).join(",");
		if (kept?.key !== key) kept = { key, value: compute() };
		return kept.value;
	};
}

/**
 * Call `listener` with the path whenever a read finds an open file replaced.
 * Returns a function that stops the calls.
 */
export function onDatabaseReplaced(listener: (path: string) => void) {
	const { listeners } = registry();
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/**
 * Close the connection for one file, whoever holds it. Call before replacing
 * a database the process may have read, and again after.
 */
export function closeReadOnlyDatabase(path: string) {
	const state = registry();
	const key = resolve(path);
	const entry = state.entries.get(key);
	if (entry) {
		state.entries.delete(key);
		closeEntry(state, entry);
	}
	for (const retired of [...state.retired])
		if (retired.path === key) closeEntry(state, retired);
}

/** Close every connection. For tests, build stages and process exit. */
export function closeAllReadOnlyDatabases() {
	const state = registry();
	for (const entry of [...state.entries.values()]) closeEntry(state, entry);
	state.entries.clear();
	for (const entry of [...state.retired]) closeEntry(state, entry);
}

/** Set how often the file is checked, or the clock. For servers and tests. */
export function configureReadOnlyDatabases(options: {
	recheckMs?: number;
	now?: () => number;
}) {
	const state = registry();
	if (options.recheckMs !== undefined) {
		if (!Number.isFinite(options.recheckMs) || options.recheckMs < 0)
			throw new Error("recheckMs must be zero or more");
		state.recheckMs = options.recheckMs;
	}
	if (options.now) state.now = options.now;
}

/** Open connections and statements, for tests and diagnostics. */
export function readOnlyDatabaseStats() {
	const state = registry();
	return {
		open: state.entries.size,
		retired: state.retired.size,
		statements: [...state.entries.values()].reduce(
			(total, entry) => total + entry.statements.size,
			0,
		),
	};
}
