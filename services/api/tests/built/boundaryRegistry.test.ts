import assert from "node:assert/strict";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createBoundaryRegistry } from "../../scripts/build-boundary-registry";
import { boundaryReleaseDeprecations } from "@uk-data-atlas/catalogue";

const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../..",
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

test("every deprecated release is in the registry with a live replacement", () => {
	const registry = createBoundaryRegistry(repositoryRoot);
	const byKey = new Map(
		registry.releases.map((release) => [
			`${release.geography}/${release.id}`,
			release,
		]),
	);
	for (const [key, deprecation] of Object.entries(
		boundaryReleaseDeprecations,
	)) {
		const release = byKey.get(key);
		assert.ok(release, `${key} is not a registered release`);
		assert.deepEqual(release.deprecation, deprecation);
		const replacement = byKey.get(
			`${release.geography}/${deprecation.replacedBy}`,
		);
		assert.ok(replacement, `${key} is replaced by a missing release`);
		assert.equal(replacement.deprecation, undefined);
		assert.ok(
			Number.isFinite(Date.parse(deprecation.deprecated)),
			`${key} has no valid deprecated date`,
		);
		if (deprecation.sunset !== undefined)
			assert.ok(deprecation.sunset > deprecation.deprecated);
	}
});
