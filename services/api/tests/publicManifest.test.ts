import { resolve as resolveRepositoryRoot } from "node:path";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "vitest";
import { readPublicManifest } from "@uk-data-atlas/atlas-runtime/storage";
import { artifactDirectory } from "@uk-data-atlas/atlas-runtime/storage";

type Fixture = { schemaVersion: 1; entries: string[] };

const apiRootWith = (t: TestContext, manifest: unknown) => {
	const root = mkdtempSync(join(tmpdir(), "public-manifest-"));
	t.onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const apiRoot = join(root, "services/api");
	mkdirSync(artifactDirectory(resolveRepositoryRoot(apiRoot, "../..")), {
		recursive: true,
	});
	writeFileSync(
		join(
			artifactDirectory(resolveRepositoryRoot(apiRoot, "../..")),
			"fixture.json",
		),
		JSON.stringify(manifest),
	);
	return root;
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
		const root = apiRootWith(t, manifest);
		assert.throws(
			() =>
				readPublicManifest<Fixture>(
					root,
					"fixture.json",
					"entries",
					"fixture manifest",
				),
			{
				message: `Invalid fixture manifest at ${join(root, "data/build/artifacts/fixture.json")}`,
			},
		);
	});
}
