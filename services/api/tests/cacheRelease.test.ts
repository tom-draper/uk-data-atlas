import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { validateCacheRelease } from "../src/cacheRelease";

test("validates the cache against the canonical database", (context) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-cache-release-"));
	context.after(() => rmSync(root, { recursive: true, force: true }));
	const directory = join(root, "data/build");
	mkdirSync(directory, { recursive: true });
	const canonical = new DatabaseSync(join(directory, "atlas.sqlite"));
	canonical.exec(
		"CREATE TABLE datasets (output TEXT, sha256 TEXT, payloadId TEXT); INSERT INTO datasets VALUES ('test', 'hash', NULL)",
	);
	canonical.close();
	assert.throws(
		() => validateCacheRelease(root),
		/Missing or mismatched atlas cache release/,
	);
	const cache = new DatabaseSync(join(directory, "atlas-cache.sqlite"));
	cache.exec(
		"CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE dataset_payloads (output TEXT, sha256 TEXT, payload TEXT)",
	);
	cache.prepare("INSERT INTO meta VALUES (?, ?)").run(
		"atlas-sqlite-content-hash",
		`sha256:${createHash("sha256")
			.update(readFileSync(join(directory, "atlas.sqlite")))
			.digest("hex")}`,
	);
	cache.exec(
		"INSERT INTO dataset_payloads VALUES ('test', 'hash', 'payload')",
	);
	cache.close();
	assert.doesNotThrow(() => validateCacheRelease(root));
	const incomplete = new DatabaseSync(join(directory, "atlas-cache.sqlite"));
	incomplete.exec("DELETE FROM dataset_payloads");
	incomplete.close();
	assert.throws(
		() => validateCacheRelease(root),
		(error: Error) =>
			String(error.cause).includes("Missing cached dataset payload test"),
	);
	const changed = new DatabaseSync(join(directory, "atlas.sqlite"));
	changed.exec("INSERT INTO datasets VALUES ('other', 'hash', NULL)");
	changed.close();
	assert.throws(
		() => validateCacheRelease(root),
		(error: Error) => String(error.cause).includes("release mismatch"),
	);
});
