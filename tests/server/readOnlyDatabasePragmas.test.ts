import {
	existsSync,
	mkdtempSync,
	readFileSync,
	renameSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	closeAllReadOnlyDatabases,
	closeReadOnlyDatabase,
	configureReadOnlyDatabases,
	connectionPragmas,
	openReadOnlyDatabase,
	readOnlyDatabaseStats,
} from "@uk-data-atlas/atlas-db";

let directory: string;
let path: string;
let clock: number;

const write = (target: string, value: string) => {
	const database = new DatabaseSync(target);
	database.exec(
		`CREATE TABLE item (id INTEGER PRIMARY KEY, value TEXT); INSERT INTO item VALUES (1, '${value}')`,
	);
	database.close();
};

const replace = (value: string) => {
	const temporary = `${path}.tmp`;
	write(temporary, value);
	renameSync(temporary, path);
};

const pragma = (name: string, file = path) => {
	const database = openReadOnlyDatabase(file);
	try {
		return Number(
			Object.values(database.prepare(`PRAGMA ${name}`).get() ?? {})[0],
		);
	} finally {
		database.release();
	}
};

const value = () => {
	const database = openReadOnlyDatabase(path);
	try {
		return (
			database.prepare("SELECT value FROM item WHERE id = 1").get() as {
				value: string;
			}
		).value;
	} finally {
		database.release();
	}
};

/** Mappings of the test file in this process, from /proc, and whether they are deleted. */
const mappings = () =>
	readFileSync("/proc/self/maps", "utf8")
		.split("\n")
		.filter((line) => line.includes(directory))
		.map((line) => ({ deleted: line.endsWith("(deleted)") }));

const mapsAvailable = existsSync("/proc/self/maps");

beforeEach(() => {
	directory = mkdtempSync(join(tmpdir(), "read-only-pragmas-"));
	path = join(directory, "atlas.sqlite");
	write(path, "one");
	clock = 0;
	configureReadOnlyDatabases({ recheckMs: 1000, now: () => clock });
});

afterEach(() => {
	vi.unstubAllEnvs();
	closeAllReadOnlyDatabases();
	configureReadOnlyDatabases({
		recheckMs: 1000,
		now: () => performance.now(),
	});
	rmSync(directory, { recursive: true, force: true });
});

describe("connection pragmas", () => {
	it("applies the defaults when a connection opens", () => {
		expect(pragma("query_only")).toBe(1);
		expect(pragma("temp_store")).toBe(0);
		expect(pragma("cache_size")).toBe(-2000);
		expect(pragma("mmap_size")).toBe(0);
		expect(readOnlyDatabaseStats().connections[0]?.pragmas).toEqual({
			queryOnly: true,
			tempStore: "default",
			cacheSize: -2000,
			mmapSize: 0,
		});
	});

	it("applies the same defaults to the cache database", () => {
		const cache = join(directory, "atlas-cache.sqlite");
		write(cache, "cache");
		expect(pragma("cache_size", cache)).toBe(-2000);
		expect(pragma("query_only", cache)).toBe(1);
	});

	it("applies them again when the file is replaced", () => {
		vi.stubEnv("ATLAS_SQLITE_CACHE_KIB", "4096");
		expect(pragma("cache_size")).toBe(-4096);
		const first = readOnlyDatabaseStats().connections[0]!.generation;
		vi.stubEnv("ATLAS_SQLITE_CACHE_KIB", "8192");
		replace("two");
		clock += 2000;
		expect(value()).toBe("two");
		const [connection] = readOnlyDatabaseStats().connections;
		expect(connection!.generation).not.toBe(first);
		expect(connection!.pragmas.cacheSize).toBe(-8192);
		expect(pragma("query_only")).toBe(1);
		expect(pragma("mmap_size")).toBe(0);
	});

	it("takes overrides from the environment", () => {
		vi.stubEnv("ATLAS_SQLITE_CACHE_KIB", "4096");
		vi.stubEnv("ATLAS_SQLITE_MMAP_BYTES", "1048576");
		vi.stubEnv("ATLAS_SQLITE_TEMP_STORE", "memory");
		expect(pragma("cache_size")).toBe(-4096);
		expect(pragma("mmap_size")).toBe(1048576);
		expect(pragma("temp_store")).toBe(2);
	});

	it("turns the guard off from the environment", () => {
		vi.stubEnv("ATLAS_SQLITE_QUERY_ONLY", "0");
		expect(pragma("query_only")).toBe(0);
	});

	it("ignores values it cannot use", () => {
		vi.stubEnv("ATLAS_SQLITE_CACHE_KIB", "-5");
		vi.stubEnv("ATLAS_SQLITE_MMAP_BYTES", "lots");
		vi.stubEnv("ATLAS_SQLITE_TEMP_STORE", "disk");
		expect(connectionPragmas()).toEqual({
			queryOnly: true,
			tempStore: "default",
			cacheKiB: 2000,
			mmapBytes: 0,
		});
		expect(pragma("cache_size")).toBe(-2000);
		expect(pragma("temp_store")).toBe(0);
	});

	it("stops writes, including to temporary tables", () => {
		const database = openReadOnlyDatabase(path);
		expect(() =>
			database.prepare("INSERT INTO item VALUES (2, 'x')").run(),
		).toThrow(/readonly/);
		expect(() =>
			database.prepare("CREATE TEMP TABLE scratch (x)").run(),
		).toThrow(/readonly/);
		database.release();
		closeReadOnlyDatabase(path);
		vi.stubEnv("ATLAS_SQLITE_QUERY_ONLY", "0");
		const open = openReadOnlyDatabase(path);
		// The file is still read only; only the temporary database is writable.
		expect(() =>
			open.prepare("INSERT INTO item VALUES (2, 'x')").run(),
		).toThrow(/readonly/);
		expect(() =>
			open.prepare("CREATE TEMP TABLE scratch (x)").run(),
		).not.toThrow();
		open.release();
	});

	it("still sorts and aggregates with the guard on", () => {
		const database = openReadOnlyDatabase(path);
		const rows = database
			.prepare(
				"WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 5000) SELECT i % 7 AS k, count(*) AS c FROM n GROUP BY k ORDER BY random()",
			)
			.all();
		expect(rows).toHaveLength(7);
		database.release();
	});
});

describe.skipIf(!mapsAvailable)("mapped files and replacement", () => {
	beforeEach(() => {
		vi.stubEnv("ATLAS_SQLITE_MMAP_BYTES", "1048576");
	});

	it("maps the file once it has been read", () => {
		expect(value()).toBe("one");
		expect(mappings()).toEqual([{ deleted: false }]);
	});

	it("keeps a mapped file valid after it is renamed over, until close", () => {
		const held = openReadOnlyDatabase(path);
		expect(
			(
				held.prepare("SELECT value FROM item WHERE id = 1").get() as {
					value: string;
				}
			).value,
		).toBe("one");
		replace("two");
		clock += 2000;
		// A new lease reopens the file, so it serves the new content.
		expect(value()).toBe("two");
		// The lease taken before the rename still reads the old mapped inode.
		expect(
			(
				held.prepare("SELECT value FROM item WHERE id = 1").get() as {
					value: string;
				}
			).value,
		).toBe("one");
		expect(readOnlyDatabaseStats().retired).toBe(1);
		expect(mappings().filter((map) => map.deleted)).toHaveLength(1);
		held.release();
	});

	it("unmaps the replaced file when its last lease ends", () => {
		const held = openReadOnlyDatabase(path);
		held.prepare("SELECT value FROM item").get();
		replace("two");
		clock += 2000;
		expect(value()).toBe("two");
		expect(mappings().some((map) => map.deleted)).toBe(true);
		held.release();
		expect(readOnlyDatabaseStats().retired).toBe(0);
		expect(mappings()).toEqual([{ deleted: false }]);
	});

	it("unmaps a replaced file at once when nothing holds it", () => {
		expect(value()).toBe("one");
		replace("two");
		clock += 2000;
		expect(value()).toBe("two");
		expect(mappings()).toEqual([{ deleted: false }]);
		closeAllReadOnlyDatabases();
		expect(mappings()).toEqual([]);
	});
});
