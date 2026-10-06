import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createFileHashCache, hashFile } from "../src/fileHashCache";

const sha = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

test("hashes a file larger than one read", () => {
	const root = mkdtempSync(join(tmpdir(), "file-hash-"));
	try {
		const content = "x".repeat((1 << 20) * 2 + 7);
		writeFileSync(join(root, "big"), content);
		assert.equal(hashFile(join(root, "big")), sha(content));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("reuses a hash across builds only while the file is unchanged", () => {
	const root = mkdtempSync(join(tmpdir(), "file-hash-"));
	try {
		const file = join(root, "source.geojson");
		const cachePath = join(root, "cache", "hashes.json");
		writeFileSync(file, "first");
		const first = createFileHashCache(cachePath);
		assert.equal(first.hash(file), sha("first"));
		first.save();

		// Same size and time: the stored hash stands, even for new content.
		const at = new Date("2026-01-01T00:00:00Z");
		writeFileSync(file, "other");
		utimesSync(file, at, at);
		const stamped = createFileHashCache(cachePath);
		assert.equal(stamped.hash(file), sha("other"));
		stamped.save();
		writeFileSync(file, "third");
		utimesSync(file, at, at);
		assert.equal(createFileHashCache(cachePath).hash(file), sha("other"));

		// A rewrite that changes its time is hashed again.
		writeFileSync(file, "fourth");
		assert.equal(createFileHashCache(cachePath).hash(file), sha("fourth"));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
