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
} from "./routeFixtures";

test("reports the hierarchy spine's coverage and names uncovered areas", () => {
	const response = route(
		"GET",
		"/v1/relationship-coverage?geography=ward&release=2025-01-en-ward&relation=within",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
	);
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.equal(data.status, "partial");
	assert.equal(data.areaCount, 2);
	assert.equal(data.relatedAreaCount, 1);
	assert.equal(data.relationshipCount, 1);
	assert.deepEqual(data.crosswalkIds, ["ward-to-local-authority-2025"]);
	assert.deepEqual(data.uncoveredAreas.map((area: { code: string }) => area.code), ["E05000002"]);
});

test("rejects an unknown relationship kind", () => {
	assert.equal(
		route(
			"GET",
			"/v1/relationship-coverage?geography=ward&release=2025-01-en-ward&relation=adjacent",
			registry,
		).status,
		400,
	);
});
