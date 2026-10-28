import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	readStoredText,
	storedTextExists,
	writeStoredText,
} from "@uk-data-atlas/artifacts";

test("stores text gzipped under its own name and reads it back", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-stored-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const path = join(directory, "shard.json");
	assert.equal(storedTextExists(path), false);
	// A plain file from an earlier build is read until it is replaced.
	writeFileSync(path, "plain");
	assert.equal(storedTextExists(path), true);
	assert.equal(readStoredText(path), "plain");
	writeStoredText(path, '{"a":"Môn"}\n');
	assert.equal(existsSync(path), false);
	assert.equal(existsSync(`${path}.gz`), true);
	assert.equal(storedTextExists(path), true);
	assert.equal(readStoredText(path), '{"a":"Môn"}\n');
});
