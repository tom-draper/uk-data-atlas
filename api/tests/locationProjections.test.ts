import assert from "node:assert/strict";
import test from "node:test";
import {
	compileLocationProjections,
	LocationProjectionStore,
} from "../src/locationProjections";
import {
	areaLookup,
	containmentCrosswalk,
	crosswalkInventory,
	namedLocationInventory,
} from "./geographyFixtures";

test("materialises named-location membership through a published crosswalk", () => {
	const compiled = compileLocationProjections(
		namedLocationInventory,
		crosswalkInventory,
		[containmentCrosswalk],
		areaLookup,
	);
	let loads = 0;
	const store = new LocationProjectionStore(compiled.inventory, (shard) => {
		loads += 1;
		return compiled.artifacts.find(
			(artifact) => artifact.crosswalkId === shard.crosswalkId,
		)!;
	});
	assert.equal(loads, 0);
	const projection = store.get(
		"greater-manchester",
		"ward",
		"2025-01-en-ward",
		"ward-to-local-authority-2025",
	);
	assert.ok(projection);
	assert.equal(projection.locationDefinitionRevision, 1);
	assert.equal(projection.membership, "fully-contained");
	assert.equal(projection.parentBoundaryRelease, "2025-01-uk-lad");
	assert.deepEqual(projection.members, [
		{
			code: "E05000001",
			labels: ["Example ward"],
			throughCode: "E08000001",
			relation: "within",
		},
	]);
	assert.deepEqual(projection.reach, {
		memberCount: 1,
		reachedCount: 1,
		unreached: [],
		complete: true,
	});
	assert.equal(projection.partialMembers, 0);
	assert.equal(projection.coverage.coversLocation, true);
	assert.equal(loads, 1);
	assert.equal(
		store.get(
			"greater-manchester",
			"ward",
			"2025-01-en-ward",
			"ward-to-local-authority-2025",
		)?.locationId,
		"greater-manchester",
	);
	assert.equal(loads, 1);
});
