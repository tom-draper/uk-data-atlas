import assert from "node:assert/strict";
import test from "node:test";
import { createGeographyResolver } from "../src/geographyResolver";
import {
	compileRelationshipPaths,
	createRelationshipPathIndex,
} from "../src/relationshipPaths";
import { route } from "../src/routes";
import type { RouteContext } from "../src/routing";
import {
	areaLookup,
	containmentCrosswalk,
	crosswalkInventory,
} from "./geographyFixtures";
import { registry } from "./routeFixtures";

const paths = compileRelationshipPaths(crosswalkInventory);
const context: RouteContext = {
	boundaryRegistry: registry,
	geographyResolver: createGeographyResolver({
		boundaryRegistry: registry,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup: new Map([
			[containmentCrosswalk.id, containmentCrosswalk],
		]),
		relationshipPathIndex: createRelationshipPathIndex(paths),
	}),
};

const query =
	"/v1/conversion-plan?sourceGeography=ward&sourceRelease=2025-01-en-ward&targetGeography=localAuthority&targetRelease=2025-01-uk-lad&purpose=membership";

test("selects the highest-ranked complete conversion path", () => {
	const response = route(
		"GET",
		`${query}&operation=containment-aggregation`,
		context,
	);
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.equal(data.status, "available");
	assert.equal(data.operation, "containment-aggregation");
	assert.equal(
		data.selectedPath.id,
		`${containmentCrosswalk.id}/forward/membership`,
	);
	assert.equal(data.selectedPath.rank.position, 1);
	assert.deepEqual(data.alternatives, []);
});

test("refuses an operation the selected path cannot support", () => {
	const response = route(
		"GET",
		`${query}&operation=weighted-allocation`,
		context,
	);
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.equal(data.status, "unsupported");
	assert.match(data.reason, /not permitted/);
	assert.equal(
		data.selectedPath.id,
		`${containmentCrosswalk.id}/forward/membership`,
	);
});

test("rejects an unrecognised planned operation", () => {
	assert.equal(
		route("GET", `${query}&operation=anything`, context).status,
		400,
	);
});
