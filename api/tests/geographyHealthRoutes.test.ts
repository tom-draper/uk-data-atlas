import assert from "node:assert/strict";
import test from "node:test";
import { route, registry, geographyInventory, areaLookup, crosswalkInventory, crosswalkLookup } from "./routeFixtures";

test("summarises relationship gaps across compiled releases", () => {
	const response = route("GET", "/v1/geography-health", registry, geographyInventory, areaLookup, crosswalkInventory, crosswalkLookup);
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.deepEqual(data.summary, { partial: 1, available: 1 });
	assert.equal(data.releases.find((release: any) => release.geography === "ward").gapCount, 1);
});
