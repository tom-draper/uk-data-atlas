import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { afterEach, test } from "vitest";
import { atlasAssetsDirectory } from "@uk-data-atlas/atlas-db";
import { writeAtlasPages } from "../../src/atlas/writeAtlasPages";

const roots: string[] = [];
const scratch = () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-pages-"));
	roots.push(root);
	return root;
};
afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});

// A page that takes far longer to compress than the ones after it, so a
// writer that listed pages as they finished would list them out of order.
const slowFirst = () => {
	let seed = 7;
	const noise = Array.from({ length: 400_000 }, () => {
		seed = (seed * 1103515245 + 12345) % 2 ** 31;
		return seed.toString(36);
	}).join(" ");
	return new Map([
		["places-big", JSON.stringify({ noise })],
		["places-small", JSON.stringify({ a: 1 })],
		["places-tiny", "{}"],
		["places-medium", JSON.stringify({ rows: Array(500).fill("row") })],
	]);
};

test("writes every page gzipped at level 9 and lists them in the given order", async () => {
	const root = scratch();
	const pages = slowFirst();
	await writeAtlasPages(root, pages);
	const directory = atlasAssetsDirectory(root);
	const manifest = JSON.parse(
		readFileSync(join(directory, "atlas-pages.json"), "utf8"),
	);
	assert.deepEqual(
		manifest.pages.map(({ id }: { id: string }) => id),
		[...pages.keys()],
	);
	for (const entry of manifest.pages) {
		const json = pages.get(entry.id)!;
		const written = readFileSync(join(directory, entry.artifact));
		assert.ok(written.equals(gzipSync(json, { level: 9 })), entry.id);
		assert.equal(gunzipSync(written).toString("utf8"), json);
		assert.equal(entry.bytes, Buffer.byteLength(json));
		assert.equal(entry.gzipBytes, written.length);
	}
	assert.equal(readdirSync(join(directory, "atlas-pages")).length, 4);
});

test("writes the same bytes on every run", async () => {
	const [first, second] = [scratch(), scratch()];
	await writeAtlasPages(first, slowFirst());
	await writeAtlasPages(second, slowFirst());
	assert.equal(
		readFileSync(
			join(atlasAssetsDirectory(first), "atlas-pages.json"),
			"utf8",
		),
		readFileSync(
			join(atlasAssetsDirectory(second), "atlas-pages.json"),
			"utf8",
		),
	);
});

test("writes an empty manifest for no pages", async () => {
	const root = scratch();
	await writeAtlasPages(root, new Map());
	assert.deepEqual(
		JSON.parse(
			readFileSync(
				join(atlasAssetsDirectory(root), "atlas-pages.json"),
				"utf8",
			),
		),
		{ schemaVersion: 1, pages: [] },
	);
});
