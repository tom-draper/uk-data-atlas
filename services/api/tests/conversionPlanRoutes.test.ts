import assert from "node:assert/strict";
import test from "node:test";
import { createGeographyResolver } from "@uk-data-atlas/atlas-runtime/areas";
import { createRelationshipPathIndex } from "@uk-data-atlas/atlas-runtime/relationships";
import { compileRelationshipPaths } from "../../../pipeline/src/relationshipPaths";
import { route } from "../src/routes";
import type { RouteContext } from "@uk-data-atlas/atlas-runtime/api";
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
	"/v1/relationships?from=ward/2025-01-en-ward&to=localAuthority/2025-01-uk-lad&purpose=membership";

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
