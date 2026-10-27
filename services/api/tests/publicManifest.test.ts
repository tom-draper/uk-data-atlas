import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { readPublicManifest } from "../src/publicManifest";
import { artifactRoot } from "../../../shared/dataLayout";

type Fixture = { schemaVersion: 1; entries: string[] };

const apiRootWith = (t: TestContext, manifest: unknown) => {
	const root = mkdtempSync(join(tmpdir(), "public-manifest-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const apiRoot = join(root, "services/api");
	mkdirSync(artifactRoot(apiRoot), { recursive: true });
	writeFileSync(
		join(artifactRoot(apiRoot), "fixture.json"),
		JSON.stringify(manifest),
	);
	return apiRoot;
};

test("reads a schema-1 manifest whose list is an array", (t) => {
	const manifest = { schemaVersion: 1, entries: ["a"] };
	assert.deepEqual(
		readPublicManifest<Fixture>(
			apiRootWith(t, manifest),
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
	test(`refuses a manifest with ${name}`, (t) => {
		const apiRoot = apiRootWith(t, manifest);
		assert.throws(
			() =>
				readPublicManifest<Fixture>(
					apiRoot,
					"fixture.json",
					"entries",
					"fixture manifest",
				),
			{
				message: `Invalid fixture manifest at ${join(artifactRoot(apiRoot), "fixture.json")}`,
			},
		);
	});
}
