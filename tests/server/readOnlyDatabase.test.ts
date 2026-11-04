import { mkdtempSync, renameSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	closeAllReadOnlyDatabases,
	closeReadOnlyDatabase,
	configureReadOnlyDatabases,
	databaseGeneration,
	memoByGeneration,
	onDatabaseReplaced,
	openReadOnlyDatabase,
	readOnlyDatabaseStats,
} from "@uk-data-atlas/atlas-runtime/storage";

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

/** Replace the file the way the pipeline does, by renaming a temporary file. */
const replace = (value: string) => {
	const temporary = `${path}.tmp`;
	write(temporary, value);
	renameSync(temporary, path);
};

const read = () => {
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

beforeEach(() => {
	directory = mkdtempSync(join(tmpdir(), "read-only-database-"));
	path = join(directory, "atlas.sqlite");
	write(path, "one");
	clock = 0;
	configureReadOnlyDatabases({ recheckMs: 1000, now: () => clock });
});

afterEach(() => {
	closeAllReadOnlyDatabases();
	configureReadOnlyDatabases({
		recheckMs: 1000,
		now: () => performance.now(),
	});
	rmSync(directory, { recursive: true, force: true });
});

describe("shared read-only connections", () => {
	it("reuses one connection across reads", () => {
		const generations = new Set<number>();
		for (let index = 0; index < 5; index += 1) {
			const database = openReadOnlyDatabase(path);
			generations.add(database.generation);
			database.release();
		}
		expect(generations.size).toBe(1);
		expect(readOnlyDatabaseStats().open).toBe(1);
	});

	it("shares the connection between path spellings", () => {
		const first = openReadOnlyDatabase(path);
		const second = openReadOnlyDatabase(
			join(directory, ".", "atlas.sqlite"),
		);
		expect(second.generation).toBe(first.generation);
		first.release();
		second.release();
		expect(readOnlyDatabaseStats().open).toBe(1);
	});

	it("opens the file read only", () => {
		const database = openReadOnlyDatabase(path);
		expect(() =>
			database.prepare("INSERT INTO item VALUES (2, 'x')").run(),
		).toThrow();
		database.release();
	});

	it("caches prepared statements by SQL", () => {
		const database = openReadOnlyDatabase(path);
		const first = database.prepare("SELECT value FROM item WHERE id = ?");
		const second = database.prepare("SELECT value FROM item WHERE id = ?");
		const other = database.prepare("SELECT id FROM item WHERE id = ?");
		expect(second).toBe(first);
		expect(other).not.toBe(first);
		expect(readOnlyDatabaseStats().statements).toBe(2);
		database.release();
		const again = openReadOnlyDatabase(path);
		expect(again.prepare("SELECT value FROM item WHERE id = ?")).toBe(
			first,
		);
		again.release();
	});

	it("bounds the statements it keeps", () => {
		const database = openReadOnlyDatabase(path);
		for (let index = 0; index < 400; index += 1)
			database.prepare(`SELECT ${index}`);
		expect(readOnlyDatabaseStats().statements).toBeLessThanOrEqual(256);
		database.release();
	});

	it("serves new content after the file is replaced by a rename", () => {
		expect(read()).toBe("one");
		const before = databaseGeneration(path);
		replace("two");
		clock += 1000;
		expect(read()).toBe("two");
		expect(databaseGeneration(path)).toBeGreaterThan(before);
		expect(readOnlyDatabaseStats().open).toBe(1);
	});

	it("drops cached statements when the file is replaced", () => {
		const sql = "SELECT value FROM item WHERE id = 1";
		const database = openReadOnlyDatabase(path);
		const statement = database.prepare(sql);
		database.release();
		replace("two");
		clock += 1000;
		const reopened = openReadOnlyDatabase(path);
		expect(Object.is(reopened.prepare(sql), statement)).toBe(false);
		reopened.release();
	});

	it("detects an in place rewrite by size and modification time", () => {
		expect(read()).toBe("one");
		const writer = new DatabaseSync(path);
		writer.exec("UPDATE item SET value = 'rewritten value' WHERE id = 1");
		writer.close();
		utimesSync(path, new Date(), new Date(Date.now() + 5000));
		clock += 1000;
		expect(read()).toBe("rewritten value");
	});

	it("checks the file at most once per interval", () => {
		expect(read()).toBe("one");
		replace("two");
		clock += 999;
		expect(read()).toBe("one");
		clock += 1;
		expect(read()).toBe("two");
	});

	it("does not miss a replacement made inside the window once it passes", () => {
		expect(read()).toBe("one");
		replace("two");
		for (let step = 0; step < 9; step += 1) {
			clock += 100;
			expect(read()).toBe("one");
		}
		replace("three");
		clock += 100;
		expect(read()).toBe("three");
	});

	it("checks at once when asked for a fresh connection", () => {
		expect(read()).toBe("one");
		replace("two");
		expect(read()).toBe("one");
		const database = openReadOnlyDatabase(path, { fresh: true });
		expect(
			database.prepare("SELECT value FROM item WHERE id = 1").get(),
		).toEqual({ value: "two" });
		database.release();
	});

	it("checks on every read when the interval is zero", () => {
		configureReadOnlyDatabases({ recheckMs: 0 });
		expect(read()).toBe("one");
		replace("two");
		expect(read()).toBe("two");
	});

	it("keeps a leased connection open until its read ends", () => {
		const held = openReadOnlyDatabase(path);
		const statement = held.prepare("SELECT value FROM item WHERE id = 1");
		replace("two");
		clock += 1000;
		expect(read()).toBe("two");
		expect(readOnlyDatabaseStats().retired).toBe(1);
		expect(statement.get()).toEqual({ value: "one" });
		held.release();
		expect(readOnlyDatabaseStats().retired).toBe(0);
		expect(readOnlyDatabaseStats().open).toBe(1);
	});

	it("tells listeners which file was replaced", () => {
		const listener = vi.fn();
		const stop = onDatabaseReplaced(listener);
		read();
		expect(listener).not.toHaveBeenCalled();
		replace("two");
		clock += 1000;
		read();
		expect(listener).toHaveBeenCalledExactlyOnceWith(path);
		stop();
		replace("three");
		clock += 1000;
		read();
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("recomputes a dependent cache after a replacement", () => {
		const compute = vi.fn(() => read());
		const value = memoByGeneration([path], compute);
		expect(value()).toBe("one");
		expect(value()).toBe("one");
		expect(compute).toHaveBeenCalledTimes(1);
		replace("two");
		clock += 1000;
		expect(value()).toBe("two");
		expect(compute).toHaveBeenCalledTimes(2);
	});

	it("does not keep a computation that throws", () => {
		let fail = true;
		const value = memoByGeneration([path], () => {
			if (fail) throw new Error("not yet");
			return "done";
		});
		expect(value).toThrow("not yet");
		fail = false;
		expect(value()).toBe("done");
	});

	it("closes one connection on request and reopens on the next read", () => {
		const before = databaseGeneration(path);
		closeReadOnlyDatabase(path);
		expect(readOnlyDatabaseStats().open).toBe(0);
		expect(read()).toBe("one");
		expect(databaseGeneration(path)).toBeGreaterThan(before);
	});

	it("closes every connection, leased or not", () => {
		const other = join(directory, "other.sqlite");
		write(other, "x");
		const held = openReadOnlyDatabase(path);
		const statement = held.prepare("SELECT value FROM item WHERE id = 1");
		openReadOnlyDatabase(other).release();
		closeAllReadOnlyDatabases();
		expect(readOnlyDatabaseStats()).toEqual({
			open: 0,
			retired: 0,
			statements: 0,
		});
		expect(() => statement.get()).toThrow();
		expect(read()).toBe("one");
	});

	it("lets the file be replaced after closing every connection", () => {
		expect(read()).toBe("one");
		closeAllReadOnlyDatabases();
		replace("two");
		expect(read()).toBe("two");
	});

	it("fails when the file does not exist", () => {
		rmSync(path);
		expect(() => openReadOnlyDatabase(path)).toThrow();
		expect(readOnlyDatabaseStats().open).toBe(0);
	});
});
