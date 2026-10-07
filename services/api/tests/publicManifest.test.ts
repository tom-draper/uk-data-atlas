import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readPublicManifest } from "../src/publicManifest";

type Fixture = { schemaVersion: 1; entries: string[] };

const apiRootWith = (manifest: unknown) => {
	const apiRoot = mkdtempSync(join(tmpdir(), "public-manifest-"));
	mkdirSync(join(apiRoot, "public"));
	writeFileSync(
		join(apiRoot, "public", "fixture.json"),
		JSON.stringify(manifest),
	);
	return apiRoot;
};

test("reads a schema-1 manifest whose list is an array", () => {
	const manifest = { schemaVersion: 1, entries: ["a"] };
	assert.deepEqual(
		readPublicManifest<Fixture>(
			apiRootWith(manifest),
			"fixture.json",
			"entries",
			"fixture manifest",
		),
		manifest,
	);
});

for (const [name, manifest] of [
	["another schema version", { schemaVersion: 2, entries: [] }],
	["a missing list", { schemaVersion: 1 }],
	["a list that is not an array", { schemaVersion: 1, entries: {} }],
] as const) {
	test(`refuses a manifest with ${name}`, () => {
		const apiRoot = apiRootWith(manifest);
		assert.throws(
			() =>
				readPublicManifest<Fixture>(
					apiRoot,
					"fixture.json",
					"entries",
					"fixture manifest",
				),
			{
				message: `Invalid fixture manifest at ${join(apiRoot, "public", "fixture.json")}`,
			},
		);
	});
}
