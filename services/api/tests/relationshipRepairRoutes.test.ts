import assert from "node:assert/strict";
import test from "node:test";
import { relationshipRepairsReport } from "@uk-data-atlas/atlas-runtime/catalogue";
import { relationshipCandidateInventory, testContext } from "./routeFixtures";

test("turns unpublished relationship candidates into a governed repair queue", () => {
	const context = testContext({ relationshipCandidateInventory });
	const data = relationshipRepairsReport(context.geographyResolver);
	assert.deepEqual(data.summary, { "compile-target-release": 1 });
	assert.equal(data.repairs[0]?.action, "compile-target-release");
	assert.equal(
		data.repairs[0]?.candidate.id,
		relationshipCandidateInventory.candidates[0]?.id,
	);
});
