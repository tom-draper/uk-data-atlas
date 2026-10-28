import assert from "node:assert/strict";
import test from "node:test";
import { measureCompatibilityReport } from "@uk-data-atlas/atlas-runtime/catalogue";
import { measureCompatibilityInventory } from "./routeFixtures";

test("reports measure boundary candidates as code compatibility only", () => {
	const data = measureCompatibilityReport(
		measureCompatibilityInventory,
		"population",
	);
	assert.ok(data);
	assert.equal(data.sources[0]?.candidates[0]?.status, "code-set-compatible");
	assert.match(data.note, /do not select a geometry release/);
	assert.equal(
		measureCompatibilityReport(measureCompatibilityInventory, "unknown"),
		undefined,
	);
});
