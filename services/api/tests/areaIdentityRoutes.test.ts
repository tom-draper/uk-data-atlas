import assert from "node:assert/strict";
import test from "node:test";
import { route as routeRequest } from "../src/routes";
import {
	route,
	registry,
	geographyInventory,
	areaLookup,
	testContext,
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

test("accepts the common ward abbreviation and identifies its canonical URL", () => {
	const response = route(
		"GET",
		"/v1/areas/wd/2025-01-en-ward/E05000001",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 200);
	assert.equal(
		response.headers?.["content-location"],
		"/v1/areas/ward/2025-01-en-ward/E05000001",
	);
	assert.equal(
		"data" in response.body &&
			(response.body.data as { geography: string }).geography,
		"ward",
	);
});

test("reads area postcode counts from the postcode service", () => {
	const counts = {
		live: 12,
		terminated: 3,
		largeUser: 2,
		edition: "2025-01",
	};
	const context = testContext({
		areaLookup,
		geographyInventory,
		postcodes: {
			postcodeCounts: (identity) => {
				assert.deepEqual(identity, {
					geography: "ward",
					boundaryRelease: "2025-01-en-ward",
					code: "E05000001",
				});
				return counts;
			},
		},
	});
	const response = routeRequest(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05000001",
		context,
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body &&
			(response.body.data as { postcodes: unknown }).postcodes,
		counts,
	);
});
