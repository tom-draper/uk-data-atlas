import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import { validateCacheRelease } from "../src/cacheRelease";

test("validates the cache against the canonical database", (context) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-cache-release-"));
	context.onTestFinished(() =>
		rmSync(root, { recursive: true, force: true }),
	);
	const directory = join(root, "data/build");
	mkdirSync(directory, { recursive: true });
	const canonical = new DatabaseSync(join(directory, "atlas.sqlite"));
	canonical.exec(
		"CREATE TABLE dataset_catalogue (output TEXT, sha256 TEXT, payload_id TEXT); INSERT INTO dataset_catalogue VALUES ('test', 'hash', NULL)",
	);
	canonical.close();
	assert.throws(
		() => validateCacheRelease(root),
		/Missing or mismatched atlas cache release/,
	);
	const cache = new DatabaseSync(join(directory, "atlas-cache.sqlite"));
	cache.exec(
		"CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE dataset_payload (output TEXT, source_sha256 TEXT, sha256 TEXT, bytes INTEGER, gzip BLOB)",
	);
	cache.prepare("INSERT INTO meta VALUES (?, ?)").run(
		"atlas-sqlite-content-hash",
		`sha256:${createHash("sha256")
			.update(readFileSync(join(directory, "atlas.sqlite")))
			.digest("hex")}`,
	);
	cache.exec(
		"INSERT INTO dataset_payload VALUES ('test', 'hash', 'generated-hash', 7, x'1f8b')",
	);
	cache.close();
	assert.doesNotThrow(() => validateCacheRelease(root));
	const incomplete = new DatabaseSync(join(directory, "atlas-cache.sqlite"));
	incomplete.exec("DELETE FROM dataset_payload");
	incomplete.close();
	assert.throws(
		() => validateCacheRelease(root),
		(error: Error) =>
			String(error.cause).includes("Missing cached dataset payload test"),
	);
	const legacy = new DatabaseSync(join(directory, "atlas-cache.sqlite"));
	legacy.exec(
		"DROP TABLE dataset_payload; CREATE TABLE dataset_payload (output TEXT, source_sha256 TEXT, sha256 TEXT, payload TEXT); INSERT INTO dataset_payload VALUES ('test', 'hash', 'generated-hash', 'payload')",
	);
	legacy.close();
	assert.throws(
		() => validateCacheRelease(root),
		(error: Error) => String(error.cause).includes("no such column: gzip"),
	);
	const changed = new DatabaseSync(join(directory, "atlas.sqlite"));
	changed.exec(
		"INSERT INTO dataset_catalogue VALUES ('other', 'hash', NULL)",
	);
	changed.close();
	assert.throws(
		() => validateCacheRelease(root),
		(error: Error) => String(error.cause).includes("release mismatch"),
	);
});
