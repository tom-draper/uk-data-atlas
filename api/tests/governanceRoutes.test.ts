import assert from "node:assert/strict";
import test from "node:test";
import {
	route,
	registry,
	geographyInventory,
	areaLookup,
	crosswalkInventory,
	crosswalkLookup,
	atlasRelease,
	relationshipCandidateInventory,
} from "./routeFixtures";
import { correctionRecords } from "../src/correctionRegister";

test("lists API-owned corrections without claiming source artifacts changed", () => {
	const response = route("GET", "/v1/corrections", registry);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body && response.body.data,
		{
			records: correctionRecords,
			filters: { measure: null },
			note: "These records describe API-owned changes to served values or semantics. They do not rewrite the publisher artifacts, which remain the source evidence.",
		},
	);
	const filtered = route(
		"GET",
		"/v1/corrections?measure=ghg-emissions",
		registry,
	);
	assert.deepEqual(
		"data" in filtered.body && filtered.body.data,
		{
			records: correctionRecords,
			filters: { measure: "ghg-emissions" },
			note: "These records describe API-owned changes to served values or semantics. They do not rewrite the publisher artifacts, which remain the source evidence.",
		},
	);
	assert.equal(
		route(
			"GET",
			"/v1/corrections?measure=ghg-emissions&measure=population-estimate",
			registry,
		).status,
		400,
	);
});

test("lists discovered relationship candidates and their coverage gaps", () => {
	const response = route(
		"GET",
		"/v1/relationship-candidates",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
		undefined,
		relationshipCandidateInventory,
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body && response.body.data,
		relationshipCandidateInventory.candidates,
	);
});

test("reports relationship candidates as unavailable before they are built", () => {
	const response = route(
		"GET",
		"/v1/relationship-candidates",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 503);
});
