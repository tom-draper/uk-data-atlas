import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, test } from "vitest";
import { parseScriptArgs } from "../../src/lib/args.ts";
import { isMainModule } from "../../src/lib/entrypoint.ts";
import {
	sha256FileHex,
	sha256FileHexSync,
	sha256Hex,
} from "../../src/lib/hash.ts";
import { readJson, readJsonSync } from "../../src/lib/json.ts";

let directory = "";
beforeAll(() => {
	directory = mkdtempSync(join(tmpdir(), "pipeline-lib-"));
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));

test("sha256Hex matches the digest of a string and of bytes", () => {
	assert.equal(
		sha256Hex("abc"),
		"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
	);
	assert.equal(sha256Hex(Buffer.from("abc")), sha256Hex("abc"));
	assert.equal(sha256Hex(""), createHash("sha256").digest("hex"));
});

test("file hashes equal the hash of the file's bytes, streamed or not", async () => {
	const path = join(directory, "large.bin");
	const bytes = Buffer.alloc((1 << 20) * 2 + 17, "atlas");
	writeFileSync(path, bytes);
	assert.equal(await sha256FileHex(path), sha256Hex(bytes));
	assert.equal(sha256FileHexSync(path), sha256Hex(bytes));
	const empty = join(directory, "empty.bin");
	writeFileSync(empty, "");
	assert.equal(await sha256FileHex(empty), sha256Hex(""));
	assert.equal(sha256FileHexSync(empty), sha256Hex(""));
});

test("readJson parses a file with or without blocking", async () => {
	const path = join(directory, "value.json");
	writeFileSync(path, JSON.stringify({ a: [1, 2] }));
	assert.deepEqual(readJsonSync(path), { a: [1, 2] });
	assert.deepEqual(await readJson(path), { a: [1, 2] });
	writeFileSync(path, "{");
	assert.throws(() => readJsonSync(path), SyntaxError);
	await assert.rejects(readJson(path), SyntaxError);
});

test("parseScriptArgs reads flags and positionals and keeps unknown ones", () => {
	const options = {
		force: { type: "boolean" },
		from: { type: "string", multiple: true },
	} as const;
	const { values, positionals } = parseScriptArgs(options, [
		"--force",
		"--from=ward",
		"--from",
		"lsoa",
		"--unknown",
		"--other=1",
		"id",
	]);
	assert.equal(values.force, true);
	assert.deepEqual(values.from, ["ward", "lsoa"]);
	assert.deepEqual(positionals, ["id"]);
	assert.deepEqual(Object.keys(parseScriptArgs(options, []).values), []);
});

test("isMainModule is true only for the script node was started with", () => {
	const original = process.argv[1];
	try {
		process.argv[1] = fileURLToPath(import.meta.url);
		assert.equal(isMainModule(import.meta.url), true);
		process.argv[1] = join(tmpdir(), "another-script.ts");
		assert.equal(isMainModule(import.meta.url), false);
		process.argv.length = 1;
		assert.equal(isMainModule(import.meta.url), false);
	} finally {
		process.argv[1] = original!;
	}
});
