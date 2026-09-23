import assert from "node:assert/strict";
import test from "node:test";
import type { AreaGeometryCache } from "../src/areaGeometry";
import { createGeographyResolver, type GeographyRequirement } from "../src/geographyResolver";
import type { LocationProjectionStore } from "../src/locationProjections";
import { areaLookup, namedLocationInventory } from "./geographyFixtures";

const requirements: GeographyRequirement[] = [
	"areas",
	"geometry",
	"relationships",
	"named-locations",
	"location-projections",
	"crosswalks",
];

test("requires returns the standard 503 for each unavailable capability", () => {
	const resolver = createGeographyResolver({});
	const details: Record<GeographyRequirement, string> = {
		areas: "Build the area identities before serving geography data.",
		geometry: "Build the area geometry cache before serving geometry data.",
		relationships: "Build the crosswalk inventory before serving area relationships.",
		"named-locations": "Build the named location inventory before serving locations.",
		"location-projections": "Build the location projection store before serving projections.",
		crosswalks: "Build the crosswalk artifacts before serving crosswalk data.",
	};

	for (const requirement of requirements) {
		const response = resolver.requires(requirement);
		assert.ok(response);
		assert.equal(response.status, 503);
		assert.ok("detail" in response.body);
		assert.equal(response.body.title, "Catalogue Unavailable");
		assert.equal(response.body.detail, details[requirement]);
	}
});

test("requires accepts each capability when its owning input is present", () => {
	const resolver = createGeographyResolver({
		areaLookup,
		areaGeometryCache: {} as AreaGeometryCache,
		crosswalkLookup: new Map(),
		namedLocationInventory,
		locationProjectionStore: {} as LocationProjectionStore,
	});

	for (const requirement of requirements)
		assert.equal(resolver.requires(requirement), undefined, requirement);
});
