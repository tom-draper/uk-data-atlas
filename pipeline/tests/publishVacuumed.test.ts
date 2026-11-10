import assert from "node:assert/strict";
import {
	existsSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { onTestFinished, test } from "vitest";
import { publishVacuumed } from "../src/storage";

function directory() {
	const path = mkdtempSync(join(tmpdir(), "publish-vacuumed-"));
	onTestFinished(() => rmSync(path, { recursive: true, force: true }));
	return path;
}

/** A database with free pages, a page size that is not the default and some pragmas. */
function bloated(path: string) {
	const database = new DatabaseSync(path);
	try {
		database.exec(
			"PRAGMA page_size = 8192; PRAGMA auto_vacuum = 2; PRAGMA user_version = 7; PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;",
		);
		database.exec(
			"CREATE TABLE t (id INTEGER PRIMARY KEY, body BLOB NOT NULL); BEGIN",
		);
		const insert = database.prepare("INSERT INTO t VALUES (?, ?)");
		for (let id = 1; id <= 400; id++)
			insert.run(id, Buffer.alloc(4000, id));
		database.exec("COMMIT; DELETE FROM t WHERE id % 2 = 0");
	} finally {
		database.close();
	}
}

function pragma(path: string, name: string) {
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		return Object.values(database.prepare(`PRAGMA ${name}`).get()!)[0];
	} finally {
		database.close();
	}
}

const count = (path: string) => {
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		return database.prepare("SELECT count(*) AS n FROM t").get()!.n;
	} finally {
		database.close();
	}
};

test("publishes a compact copy that keeps the rows and the page layout", () => {
	const root = directory();
	const work = join(root, "work.sqlite");
	const published = join(root, "published.sqlite");
	bloated(work);
	assert.equal(publishVacuumed(work, published), published);
	assert.equal(count(published), 200);
	assert.equal(pragma(published, "freelist_count"), 0);
	assert.equal(pragma(published, "page_size"), 8192);
	assert.equal(pragma(published, "auto_vacuum"), 2);
	assert.equal(pragma(published, "user_version"), 7);
	assert.equal(pragma(published, "integrity_check"), "ok");
	assert.ok(statSync(published).size < statSync(work).size);
	assert.equal(count(work), 200, "the working file is left as it was");
	assert.deepEqual(readdirSync(root).sort(), [
		"published.sqlite",
		"work.sqlite",
	]);
});

test("replaces an earlier published file and runs the hooks around the rename", () => {
	const root = directory();
	const work = join(root, "work.sqlite");
	const published = join(root, "published.sqlite");
	bloated(work);
	writeFileSync(published, "an earlier release");
	const events: string[] = [];
	publishVacuumed(work, published, {
		finish: (database) => {
			events.push("finish");
			database.exec("DELETE FROM t WHERE id > 100");
		},
		beforeReplace: () => {
			events.push("beforeReplace");
			assert.equal(
				readdirSync(root).includes("published.sqlite.tmp"),
				true,
			);
		},
	});
	assert.deepEqual(events, ["finish", "beforeReplace"]);
	assert.equal(count(published), 50);
	assert.equal(
		count(work),
		200,
		"the finish step does not touch the working file",
	);
});

test("removes a stale temporary file left by a build that stopped", () => {
	const root = directory();
	const work = join(root, "work.sqlite");
	const published = join(root, "published.sqlite");
	bloated(work);
	writeFileSync(`${published}.tmp`, "half a database");
	writeFileSync(`${published}.tmp-journal`, "half a journal");
	publishVacuumed(work, published);
	assert.equal(count(published), 200);
	assert.equal(existsSync(`${published}.tmp`), false);
	assert.equal(existsSync(`${published}.tmp-journal`), false);
});

test("a failure part way leaves the published file untouched and no temporary file", () => {
	const root = directory();
	const work = join(root, "work.sqlite");
	const published = join(root, "published.sqlite");
	bloated(work);
	publishVacuumed(work, published);
	const before = statSync(published);

	const failures: Array<() => void> = [
		() =>
			publishVacuumed(
				join(root, "missing-dir", "work.sqlite"),
				published,
			),
		() => {
			writeFileSync(
				join(root, "not-a-database.sqlite"),
				"not sqlite ".repeat(50),
			);
			publishVacuumed(join(root, "not-a-database.sqlite"), published);
		},
		() =>
			publishVacuumed(work, published, {
				finish: (database) => {
					database.exec("DELETE FROM t");
					throw new Error("finish failed");
				},
			}),
		() =>
			publishVacuumed(work, published, {
				beforeReplace: () => {
					throw new Error("a reader would not let go");
				},
			}),
	];
	for (const run of failures) assert.throws(run);

	assert.equal(count(published), 200);
	assert.equal(statSync(published).ino, before.ino);
	assert.equal(statSync(published).mtimeMs, before.mtimeMs);
	assert.equal(existsSync(`${published}.tmp`), false);
});
