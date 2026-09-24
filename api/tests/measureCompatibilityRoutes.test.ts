import assert from "node:assert/strict";
import test from "node:test";
import { route as routeRequest } from "../src/routes";
import {
	registry,
	measureCompatibilityInventory,
	testContext,
} from "./routeFixtures";

test("publishes measure boundary candidates as code compatibility only", () => {
	const response = routeRequest(
		"GET",
		"/v1/measures/population-estimate/compatibility",
		testContext({
			boundaryRegistry: registry,
			measureCompatibilityInventory,
		}),
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.ok(data && typeof data === "object");
	assert.equal(
		(data as { sources: Array<{ candidates: Array<{ status: string }> }> })
			.sources[0]?.candidates[0]?.status,
		"code-set-compatible",
	);
	assert.match(
		(data as { note: string }).note,
		/do not select a geometry release/,
	);
});
