import assert from "node:assert/strict";
import test from "node:test";
import type { AreaGeometryCache } from "../src/areaGeometry";
import {
	createGeographyResolver,
	type GeographyRequirement,
} from "../src/geographyResolver";
import type { LocationProjectionStore } from "../src/locationProjections";
import { compileAreaSearchIndex } from "../src/areaSearch";
import { compilePlaceIndex } from "../src/placeIndex";
import { postcodeIndexFor, postcodeRow } from "./postcodeFixtures";
import { areaLookup, namedLocationInventory } from "./geographyFixtures";

const requirements: GeographyRequirement[] = [
	"areas",
	"places",
	"area-search",
	"postcodes",
	"geometry",
	"relationships",
	"named-locations",
	"location-projections",
	"crosswalks",
];

test("requires returns the standard 503 for each unavailable capability", () => {
	const resolver = createGeographyResolver({});
	const details: Record<GeographyRequirement, string> = {
		areas: "Build the area inventory before serving geography data.",
		places: "Build the place index before resolving place names.",
		"area-search": "Build the area search index before searching areas.",
		postcodes: "Build the postcode index before resolving postcodes.",
		geometry: "Build the geometry source registry before serving geometry.",
		relationships:
			"Build the crosswalk inventory before serving area relationships.",
		"named-locations":
			"Build the named location inventory before serving locations.",
		"location-projections":
			"Build the location projection inventory before serving location projections.",
		crosswalks:
			"Build the crosswalk artifacts before serving crosswalk data.",
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
		placeIndex: compilePlaceIndex(
			areaLookup,
			namedLocationInventory,
			"sha256:fixture-areas",
		),
		areaSearchIndex: compileAreaSearchIndex(
			areaLookup,
			"sha256:fixture-areas",
		),
		postcodeIndex: postcodeIndexFor([postcodeRow("M1 1AE")]).index,
		areaGeometryCache: {} as AreaGeometryCache,
		crosswalkLookup: new Map(),
		namedLocationInventory,
		locationProjectionStore: {} as LocationProjectionStore,
	});

	for (const requirement of requirements)
		assert.equal(resolver.requires(requirement), undefined, requirement);
});
