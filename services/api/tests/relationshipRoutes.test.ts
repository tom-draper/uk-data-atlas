import assert from "node:assert/strict";
import test from "node:test";
import { compileRelationshipPaths } from "../src/relationshipPaths";
import { route } from "../src/routes";
import {
	areaLookup,
	containmentCrosswalk,
	crosswalkInventory,
} from "./geographyFixtures";
import { registry, testContext } from "./routeFixtures";

const conversion =
	"from=ward/2025-01-en-ward&to=localAuthority/2025-01-uk-lad&purpose=membership";

const context = () =>
	testContext({
		boundaryRegistry: registry,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup: new Map([
			[containmentCrosswalk.id, containmentCrosswalk],
		]),
		relationshipPathInventory: compileRelationshipPaths(crosswalkInventory),
	});

test("uses one route for relationship discovery and conversion planning", () => {
	const discovery = route(
		"GET",
		"/v1/relationships?from=ward/2025-01-en-ward",
		context(),
	);
	assert.equal(discovery.status, 200);
	assert.equal((discovery.body as { data: any }).data.status, "available");

	const capability = route(
		"GET",
		`/v1/relationships?${conversion}`,
		context(),
	);
	assert.equal(capability.status, 200);
	assert.equal((capability.body as { data: any }).data.paths.length, 1);

	const plan = route(
		"GET",
		`/v1/relationships?${conversion}&operation=containment-aggregation`,
		context(),
	);
	assert.equal(plan.status, 200);
	assert.equal((plan.body as { data: any }).data.status, "available");
	assert.equal(
		(plan.body as { data: any }).data.selectedPath.id,
		`${containmentCrosswalk.id}/forward/membership`,
	);
});

test("uses the same route for release relationship coverage", () => {
	const response = route(
		"GET",
		"/v1/relationships?geography=ward&release=2025-01-en-ward&relation=within",
		context(),
	);
	assert.equal(response.status, 200);
	assert.equal((response.body as { data: any }).data.status, "available");
});

test("refuses a mixed conversion and coverage query", () => {
	const response = route(
		"GET",
		"/v1/relationships?from=ward/2025-01-en-ward&geography=ward&release=2025-01-en-ward",
		context(),
	);
	assert.equal(response.status, 400);
});
