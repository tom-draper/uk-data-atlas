import assert from "node:assert/strict";
import test from "node:test";
import { route, registry, relationshipCandidateInventory } from "./routeFixtures";

test("turns unpublished relationship candidates into a governed repair queue", () => {
	const response = route(
		"GET",
		"/v1/relationship-repairs",
		registry,
		undefined, undefined, undefined, undefined, undefined, undefined,
		relationshipCandidateInventory,
	);
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.deepEqual(data.summary, { "compile-target-release": 1 });
	assert.equal(data.repairs[0].action, "compile-target-release");
	assert.equal(data.repairs[0].candidate.id, relationshipCandidateInventory.candidates[0]?.id);
});
