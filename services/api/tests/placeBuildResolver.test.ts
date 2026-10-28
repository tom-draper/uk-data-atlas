import assert from "node:assert/strict";
import test from "node:test";
import { createPlaceResolver } from "../../../pipeline/src/placeResolver";
import { createGeographyResolver } from "@uk-data-atlas/atlas-runtime/areas";

test("place build resolver answers with the same supplied area and relationship data", () => {
	const areaLookup = new Map([
		["ward/2024", new Map([["W1", { code: "W1", name: "One" }]])],
	]);
	const inputs = { areaLookup, crosswalkLookup: new Map() };
	const focused = createPlaceResolver(inputs);
	const original = createGeographyResolver(inputs);
	const identity = { geography: "ward", boundaryRelease: "2024", code: "W1" };
	assert.deepEqual(focused.area(identity), original.area(identity));
	assert.deepEqual(focused.areaReleases(), original.areaReleases());
	assert.deepEqual(
		focused.areaCodes("ward", "2024"),
		original.areaCodes("ward", "2024"),
	);
	assert.deepEqual(
		focused.areaGeometry(identity),
		original.areaGeometry(identity),
	);
	assert.deepEqual(
		focused.areaNeighbours(identity),
		original.areaNeighbours(identity),
	);
	assert.deepEqual(
		focused.areaRelationshipSummary(identity),
		original.areaRelationshipSummary(identity),
	);
	assert.deepEqual(focused.namedLocations(), original.namedLocations());
	assert.deepEqual(
		focused.namedLocationsForArea(identity),
		original.namedLocationsForArea(identity),
	);
});
