import assert from "node:assert/strict";
import test from "node:test";
import { route, registry, geographyInventory, areaLookup, crosswalkInventory, crosswalkLookup } from "./routeFixtures";
import { createGeographyResolver } from "../src/geographyResolver";

test("summarises relationship gaps across compiled releases", () => {
	const response = route("GET", "/v1/geography-health", registry, geographyInventory, areaLookup, crosswalkInventory, crosswalkLookup);
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.deepEqual(data.summary, { partial: 1, available: 1 });
	assert.equal(data.releases.find((release: any) => release.geography === "ward").gapCount, 1);
});

test("keeps identity coverage visible when relationship artifacts are not built", () => {
	const health = createGeographyResolver({ areaLookup }).geographyHealth();
	assert.deepEqual(health.find((release) => release.geography === "ward"), {
		geography: "ward", boundaryRelease: "2025-01-en-ward", status: "not-built",
		areaCount: 2, relatedAreaCount: 0, gapCount: 2,
	});
});

test("filters the repair dashboard to one geography", () => {
	const response = route("GET", "/v1/geography-health?geography=ward", registry, geographyInventory, areaLookup, crosswalkInventory, crosswalkLookup);
	const data = (response.body as { data: any }).data;
	assert.equal(data.releases.length, 1);
	assert.equal(data.filters.geography, "ward");
});
