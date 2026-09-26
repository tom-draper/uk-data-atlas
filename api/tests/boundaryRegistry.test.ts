import assert from "node:assert/strict";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createBoundaryRegistry } from "../scripts/build-boundary-registry";

const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../..",
);

test("builds an API-safe registry for every boundary metadata record", () => {
	const registry = createBoundaryRegistry(repositoryRoot);

	assert.equal(registry.schemaVersion, 1);
	assert.match(registry.contentHash, /^sha256:[a-f0-9]{64}$/);
	assert.ok(registry.releases.length > 0);
	assert.ok(
		registry.releases.every(
			(release) =>
				release.id.length > 0 &&
				release.geography.length > 0 &&
				release.coverage.countries.length > 0,
		),
	);
	assert.ok(
		registry.releases.every(
			(release) => !JSON.stringify(release).includes("/data/boundaries/"),
		),
	);
});
