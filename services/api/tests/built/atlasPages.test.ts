import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { readAtlasPages } from "@uk-data-atlas/atlas-runtime/storage";

const pages = readAtlasPages(resolve(import.meta.dirname, "../.."));
test("the built website artifacts match their download metadata", () => {
	for (const id of [
		"places-index",
		"docs-catalogue",
		"place-facts",
		"ward-areas",
		"places-named-cumbria",
	])
		assert.ok(pages.has(id), id);
	assert.ok(pages.size > 100);
	for (const [id, file] of pages) {
		const json = gunzipSync(readFileSync(file.path));
		assert.equal(json.length, file.bytes, id);
		assert.equal(
			`sha256:${createHash("sha256").update(json).digest("hex")}`,
			file.contentHash,
			id,
		);
		assert.ok(JSON.parse(json.toString()), id);
	}
});
test("place facts and ward areas are available independently of profile shards", () => {
	const read = (id: string) =>
		JSON.parse(gunzipSync(readFileSync(pages.get(id)!.path)).toString());
	assert.ok(read("place-facts").E06000063.age[0] > 0);
	const wardCodes = Object.keys(read("ward-areas"));
	assert.ok(wardCodes.length > 1000);
	assert.ok(wardCodes.every((code) => /^[EW]05/.test(code)));
	assert.ok(read("docs-catalogue").datasets.length > 0);
});
