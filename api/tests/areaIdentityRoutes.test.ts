import assert from "node:assert/strict";
import test from "node:test";
import {
	route,
	registry,
	geographyInventory,
	areaLookup,
} from "./routeFixtures";

test("gets a compiled area by its full identity", () => {
	const response = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05000001",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 200);
	assert.deepEqual("data" in response.body && response.body.data, {
		id: "ward/2025-01-en-ward/E05000001",
		geography: "ward",
		boundaryRelease: "2025-01-en-ward",
		code: "E05000001",
		name: "Example ward",
		aliases: ["Enghraifft ward"],
	});
});
