import assert from "node:assert/strict";
import test from "node:test";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import { createGeographyResolver } from "../src/geographyResolver";
import {
	compileLocationProjections,
	LocationProjectionStore,
} from "../src/locationProjections";
import {
	compileRelationshipPaths,
	createRelationshipPathIndex,
} from "../src/relationshipPaths";
import {
	areaLookup,
	containmentCrosswalk,
	crosswalkInventory,
	namedLocationInventory,
	namedLocationLookup,
} from "./geographyFixtures";

const releaseRegistry: BoundaryRegistry = {
	schemaVersion: 1,
	contentHash: "sha256:boundary-registry",
	releases: [
		{
			id: "2024-05-uk-bgc",
			geography: "ward",
			title: "Ward boundaries",
			coverage: { countries: ["GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS"] },
			source: {
				publisher: "ONS",
				url: "https://example.com",
				licence: { name: "Open Government Licence" },
			},
			metadataHash: "sha256:ward-boundaries",
		},
	],
};

test("builds immutable geography indexes once for route-level queries", () => {
	const locationProjections = compileLocationProjections(
		namedLocationInventory,
		crosswalkInventory,
		[containmentCrosswalk],
		areaLookup,
	);
	const relationshipPaths = compileRelationshipPaths(crosswalkInventory);
	const resolver = createGeographyResolver({
		areaLookup,
		crosswalkInventory,
		crosswalkLookup: new Map([
			[containmentCrosswalk.id, containmentCrosswalk],
		]),
		namedLocationLookup,
		locationProjectionStore: new LocationProjectionStore(
			locationProjections.inventory,
			(shard) =>
				locationProjections.artifacts.find(
					(artifact) => artifact.crosswalkId === shard.crosswalkId,
				)!,
		),
		relationshipPathIndex: createRelationshipPathIndex(relationshipPaths),
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
	assert.equal(
		resolver.locationProjection(
			"greater-manchester",
			"ward",
			"2025-01-en-ward",
			containmentCrosswalk.id,
		)?.membership,
		"fully-contained",
	);
	assert.deepEqual(
		resolver
			.relationshipPaths(
				{ geography: "ward", boundaryRelease: "2025-01-en-ward" },
				{
					geography: "localAuthority",
					boundaryRelease: "2025-01-uk-lad",
				},
				"membership",
			)
			.map((path) => path.id),
		[`${containmentCrosswalk.id}/forward/membership`],
	);
});

test("does not claim optional geography capabilities when their artifacts are absent", () => {
	const resolver = createGeographyResolver({ areaLookup });
	const ward = {
		geography: "ward",
		boundaryRelease: "2025-01-en-ward",
		code: "E05000001",
	};

	assert.equal(resolver.hasAreaRelease("ward", "2025-01-en-ward"), true);
	assert.equal(resolver.hasAreaRelationships(), false);
	assert.equal(resolver.hasAreaGeometryCache(), false);
	assert.equal(resolver.hasLocationProjectionStore(), false);
	assert.equal(
		resolver.selectReleaseForDate("ward", "2025-01"),
		undefined,
	);
	assert.equal(resolver.geometryFor(ward), undefined);
	assert.deepEqual(resolver.relationships(ward), []);
	assert.deepEqual(
		resolver.relationshipPaths(
			{ geography: "ward", boundaryRelease: "2025-01-en-ward" },
			{
				geography: "localAuthority",
				boundaryRelease: "2025-01-uk-lad",
			},
			"membership",
		),
		[],
	);
	assert.deepEqual(
		resolver.crosswalksToLocationMembers(
			"ward",
			"2025-01-en-ward",
			"localAuthority",
		),
		[],
	);
	assert.equal(
		resolver.locationProjection(
			"greater-manchester",
			"ward",
			"2025-01-en-ward",
			"ward-to-local-authority-2025",
		),
		undefined,
	);
	assert.deepEqual(
		resolver.locationParentCrosswalks("region", "2025-12-en"),
		[],
	);
	assert.equal(
		resolver.locationParents(
			"greater-manchester",
			"local-authority-to-region-2025",
		),
		undefined,
	);
});

test("owns date-based release selection when its boundary registry is compiled", () => {
	const resolver = createGeographyResolver({ boundaryRegistry: releaseRegistry });
	const selection = resolver.selectReleaseForDate("ward", "2025-01", "GB-SCT");
	assert.equal(selection?.status, "selected");
	assert.equal(
		selection?.status === "selected" && selection.selected.id,
		"2024-05-uk-bgc",
	);
});
