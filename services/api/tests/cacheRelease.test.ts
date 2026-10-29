import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
	writeFileSync(join(directory, "atlas.sqlite"), "first");
	assert.throws(
		() => validateCacheRelease(root),
		/Missing or mismatched atlas cache release/,
	);
	const cache = new DatabaseSync(join(directory, "atlas-cache.sqlite"));
	cache.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
	cache
		.prepare("INSERT INTO meta VALUES (?, ?)")
		.run(
			"atlas-sqlite-content-hash",
			`sha256:${createHash("sha256").update("first").digest("hex")}`,
		);
	cache.close();
	assert.doesNotThrow(() => validateCacheRelease(root));
	writeFileSync(join(directory, "atlas.sqlite"), "second");
	assert.throws(
		() => validateCacheRelease(root),
		(error: Error) => String(error.cause).includes("release mismatch"),
	);
});
