import assert from "node:assert/strict";
import test from "node:test";
import { createGeographyResolver } from "../src/geographyResolver";
import {
	areaLookup,
	containmentCrosswalk,
	crosswalkInventory,
	namedLocationLookup,
} from "./geographyFixtures";

test("builds immutable geography indexes once for route-level queries", () => {
	const resolver = createGeographyResolver({
		areaLookup,
		crosswalkInventory,
		crosswalkLookup: new Map([[containmentCrosswalk.id, containmentCrosswalk]]),
		namedLocationLookup,
	});

	assert.deepEqual(
		resolver.searchAreas({ query: "gm" }).map((area) => area.id),
		["localAuthority/2025-01-uk-lad/E08000001"],
	);
	assert.equal(
		resolver.area({
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			code: "E05000001",
		})?.name,
		"Example ward",
	);
	assert.equal(
		resolver
			.relationships({
				geography: "ward",
				boundaryRelease: "2025-01-en-ward",
				code: "E05000001",
			})
			.at(0)?.relation,
		"within",
	);
	assert.deepEqual(
		resolver
			.crosswalksToLocationMembers(
				"ward",
				"2025-01-en-ward",
				"localAuthority",
			)
			.map((crosswalk) => crosswalk.id),
		["ward-to-local-authority-2025"],
	);
	assert.equal(
		resolver.namedLocation("greater-manchester")?.label,
		"Greater Manchester",
	);
});
