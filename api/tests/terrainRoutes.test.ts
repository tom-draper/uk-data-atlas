import assert from "node:assert/strict";
import test from "node:test";
import { route as routeRequest } from "../src/routes";
import { createTerrainCatalogue } from "../src/terrainCatalogue";
import { testContext } from "./routeFixtures";

test("terrain catalogue is explicit about planned rather than served products", () => {
	const response = routeRequest(
		"GET",
		"/v1/terrain",
		testContext({ terrainCatalogue: createTerrainCatalogue() }),
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body
			? (
					response.body.data as {
						products: Array<{
							id: string;
							availability: { status: string };
						}>;
					}
				).products.map((product) => [
					product.id,
					product.availability.status,
				])
			: [],
		[
			["terrain-elevation", "not-published"],
			["surface-elevation", "not-published"],
			["terrain-slope", "not-published"],
			["terrain-aspect", "not-published"],
			["terrain-contours", "not-published"],
			["terrain-hillshade", "not-published"],
		],
	);
});

test("terrain product lookup neither guesses an id nor claims a missing catalogue", () => {
	const catalogue = testContext({
		terrainCatalogue: createTerrainCatalogue(),
	});
	const product = routeRequest(
		"GET",
		"/v1/terrain/terrain-contours",
		catalogue,
	);
	assert.equal(product.status, 200);
	assert.equal(
		"data" in product.body
			? (product.body.data as { kind: string }).kind
			: undefined,
		"vector",
	);
	assert.equal(
		routeRequest("GET", "/v1/terrain/contours", catalogue).status,
		404,
	);
	assert.equal(routeRequest("GET", "/v1/terrain", testContext()).status, 503);
});
