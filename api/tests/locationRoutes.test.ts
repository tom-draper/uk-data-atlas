import assert from "node:assert/strict";
import test from "node:test";
import { route as routeRequest } from "../src/routes";
import { createGeographyResolver } from "../src/geographyResolver";
import {
	compileLocationProjections,
	LocationProjectionStore,
} from "../src/locationProjections";
import type { RouteContext } from "../src/routing";
import type { CrosswalkInventory } from "../src/crosswalkInventory";
import {
	registry,
	testContext,
	geographyInventory,
	areaLookup,
	namedLocationAreaLookup,
	crosswalkInventory,
	containmentCrosswalk,
	crosswalkLookup,
	namedLocationInventory,
	namedLocationLookup,
} from "./routeFixtures";

const routeWithNamedLocations = (url: string) =>
	routeRequest(
		"GET",
		url,
		testContext({
			geographyInventory,
			areaLookup: namedLocationAreaLookup,
			crosswalkInventory,
			crosswalkLookup,
			namedLocationInventory,
			namedLocationLookup,
		}),
	);

test("publishes curated named locations and reports unresolved legacy members", () => {
	const list = routeWithNamedLocations("/v1/locations?q=greater");
	assert.equal(list.status, 200);
	assert.deepEqual("data" in list.body && list.body.data, [
		namedLocationInventory.locations[0],
	]);

	const members = routeWithNamedLocations(
		"/v1/locations/greater-manchester/members?release=2025-01-uk-lad",
	);
	assert.equal(members.status, 200);
	assert.deepEqual("data" in members.body && members.body.data, {
		location: namedLocationInventory.locations[0],
		geography: "localAuthority",
		boundaryRelease: "2025-01-uk-lad",
		membership: "direct-code-match",
		members: [
			{
				id: "localAuthority/2025-01-uk-lad/E08000001",
				code: "E08000001",
				name: "Greater Manchester",
				aliases: ["GM"],
			},
		],
		unresolvedMemberCodes: ["E08000000", "E08000998", "E08000999"],
		coverage: {
			memberCodeCount: 4,
			resolvedCount: 1,
			unresolvedCount: 3,
			complete: false,
			// Two of the three absences are the wrong vintage, which a location
			// spanning several of them always has. The third is in no release at
			// all, and that is what stops the location covering its ground.
			// Two absences are the wrong vintage and one is a legacy alias
			// naming no compiled area. None is an unexplained gap, so the
			// location still covers its ground.
			coversLocation: true,
			unexplained: [],
			legacy: [{ code: "E08000000", status: "unknown", presentIn: [] }],
			unresolved: [
				{ code: "E08000000", status: "unknown", presentIn: [] },
				{
					code: "E08000998",
					status: "not-yet-current",
					name: "Recoded authority",
					presentIn: ["2026-05-uk-lad"],
				},
				{
					code: "E08000999",
					status: "superseded",
					name: "Legacy authority",
					presentIn: ["2019-12-uk-lad"],
				},
			],
			note: "Coverage compares member codes against compiled area releases only. An unresolved code is not a claim that the place is missing, and a resolved one is not a claim of equal geometry. `complete` means every listed code resolved, which a location spanning several vintages never does; `coversLocation` is the one to read, and means every code that did not resolve was either the wrong vintage for this release or a legacy alias naming no compiled area, rather than an unexplained absence. Codes of the second kind are listed separately in `legacy`.",
		},
	});
});

test("uses a location's declared member geography for direct membership", () => {
	const inventory = {
		...namedLocationInventory,
		locations: [
			{
				id: "example-wards",
				label: "Example wards",
				kind: "editorial-grouping" as const,
				memberGeography: "ward",
				memberCodes: ["E05000001"],
				bbox: [-2.5, 53.3, -2, 53.7] as [number, number, number, number],
			},
		],
	};
	const lookup = new Map(inventory.locations.map((location) => [location.id, location]));
	const response = routeRequest(
		"GET",
		"/v1/locations/example-wards/members?release=2025-01-en-ward",
		{
			boundaryRegistry: registry,
			areaLookup,
			namedLocationInventory: inventory,
			namedLocationLookup: lookup,
			geographyResolver: createGeographyResolver({
				areaLookup,
				namedLocationLookup: lookup,
			}),
		},
	);
	assert.equal(response.status, 200);
	const data = ("data" in response.body && response.body.data) as {
		geography: string;
		membership: string;
		members: { code: string }[];
	};
	assert.equal(data.geography, "ward");
	assert.equal(data.membership, "direct-code-match");
	assert.deepEqual(data.members.map((member) => member.code), ["E05000001"]);
});

test("resolves a named location into another geography through a crosswalk", () => {
	// The shared inventory lists only the constituency lookup; this test needs
	// the containment crosswalk advertised as well, since the route offers the
	// caller what the inventory publishes.
	const inventory: CrosswalkInventory = {
		...crosswalkInventory,
		crosswalks: [
			...crosswalkInventory.crosswalks,
			{
				id: containmentCrosswalk.id,
				from: containmentCrosswalk.from,
				to: containmentCrosswalk.to,
				method: containmentCrosswalk.method,
				quality: containmentCrosswalk.quality,
				weighting: containmentCrosswalk.weighting,
				recordCount: containmentCrosswalk.records.length,
				artifact: `crosswalks/${containmentCrosswalk.id}.json`,
				contentHash: containmentCrosswalk.contentHash,
			},
		],
	};
	const locationProjections = compileLocationProjections(
		namedLocationInventory,
		inventory,
		crosswalkLookup.values(),
		areaLookup,
	);
	const context: RouteContext = {
		boundaryRegistry: registry,
		areaLookup,
		crosswalkInventory: inventory,
		crosswalkLookup,
		namedLocationLookup,
		geographyResolver: createGeographyResolver({
			areaLookup,
			crosswalkInventory: inventory,
			crosswalkLookup,
			namedLocationLookup,
			locationProjectionStore: new LocationProjectionStore(
				locationProjections.inventory,
				(shard) =>
					locationProjections.artifacts.find(
						(artifact) =>
							artifact.crosswalkId === shard.crosswalkId,
					)!,
			),
		}),
	};
	const ask = (query: string) =>
		routeRequest(
			"GET",
			`/v1/locations/greater-manchester/members?${query}`,
			context,
		);

	// A location is curated as local authority codes, so asking for wards
	// without naming a crosswalk is answered with the ones to choose from
	// rather than an empty list or a silent choice.
	const unnamed = ask("geography=ward&release=2025-01-en-ward");
	assert.equal(unnamed.status, 400);
	assert.match(
		(unnamed.body as { detail: string }).detail,
		/ward-to-local-authority-2025/,
	);

	const resolved = ask(
		"geography=ward&release=2025-01-en-ward&via=ward-to-local-authority-2025",
	);
	assert.equal(
		resolved.status,
		200,
		JSON.stringify(resolved.body).slice(0, 300),
	);
	const data = ("data" in resolved.body && resolved.body.data) as {
		membership: string;
		membershipNote: string;
		partialMembers: number;
		parentGeography: string;
		parentBoundaryRelease: string;
		via: { id: string; method: string };
		members: {
			id: string;
			code: string;
			name: string;
			through: { code: string };
			weight?: number;
		}[];
	};
	assert.equal(data.membership, "fully-contained");
	assert.equal(data.via.id, "ward-to-local-authority-2025");
	assert.equal(data.via.method, "clean-containment");
	// The location's own codes are resolved against the release the crosswalk
	// ends at, not the ward release the caller asked for.
	assert.equal(data.parentGeography, "localAuthority");
	assert.equal(data.parentBoundaryRelease, "2025-01-uk-lad");
	assert.deepEqual(
		data.members.map((member) => member.code),
		["E05000001"],
	);
	// Each member names the authority it was found through, so the step is
	// visible rather than implied.
	assert.equal(data.members[0]!.through.code, "E08000001");
	assert.equal(data.members[0]!.name, "Example ward");
	// Containment reports no share: the ward is wholly inside.
	assert.equal(data.members[0]!.weight, undefined);
	assert.equal(data.partialMembers, 0);
	assert.match(data.membershipNote, /wholly inside/);

	const withoutProjections: RouteContext = {
		...context,
		geographyResolver: createGeographyResolver({
			areaLookup,
			crosswalkInventory: inventory,
			crosswalkLookup,
			namedLocationLookup,
		}),
	};
	const missingProjection = routeRequest(
		"GET",
		"/v1/locations/greater-manchester/members?geography=ward&release=2025-01-en-ward&via=ward-to-local-authority-2025",
		withoutProjections,
	);
	assert.equal(missingProjection.status, 503);
	assert.match(
		(missingProjection.body as { detail: string }).detail,
		/location projection inventory/,
	);

	// A crosswalk that does not start from the requested geography and release
	// is not silently substituted.
	assert.equal(
		ask(
			"geography=ward&release=2025-01-en-ward&via=constituency-2010-to-2024",
		).status,
		404,
	);
	assert.equal(
		ask(
			"geography=ward&release=1999-01-en-ward&via=ward-to-local-authority-2025",
		).status,
		404,
	);

	// The curated geography still resolves directly, with no crosswalk.
	const direct = ask("geography=localAuthority&release=2025-01-uk-lad");
	assert.equal(direct.status, 200);
	assert.equal(
		("data" in direct.body && direct.body.data) !== undefined &&
			(direct.body as { data: { membership: string } }).data.membership,
		"direct-code-match",
	);
});

test("says which parents a named location covers or meets", () => {
	const toRegion = {
		...containmentCrosswalk,
		contentHash: "sha256:authority-to-region",
		id: "local-authority-to-region-2025",
		method: "official-lookup" as const,
		relationshipPurpose: "membership" as const,
		weighting: { status: "not-provided" as const },
		from: {
			geography: "localAuthority",
			boundaryRelease: "2025-01-uk-lad",
		},
		to: { geography: "region", boundaryRelease: "2025-12-en" },
		records: [
			{
				source: { code: "E08000001", labels: ["Greater Manchester"] },
				targets: [{ code: "E12000002", labels: ["North West"] }],
			},
			{
				source: { code: "E08000002", labels: ["Elsewhere"] },
				targets: [{ code: "E12000002", labels: ["North West"] }],
			},
		],
	};
	const inventory: CrosswalkInventory = {
		...crosswalkInventory,
		crosswalks: [
			{
				id: toRegion.id,
				from: toRegion.from,
				to: toRegion.to,
				method: toRegion.method,
				quality: toRegion.quality,
				relationshipPurpose: toRegion.relationshipPurpose,
				weighting: toRegion.weighting,
				recordCount: toRegion.records.length,
				artifact: `crosswalks/${toRegion.id}.json`,
				contentHash: toRegion.contentHash,
			},
		],
	};
	const compiled = compileLocationProjections(
		namedLocationInventory,
		inventory,
		[toRegion],
		areaLookup,
	);
	assert.equal(compiled.inventory.parentShards.length, 1);
	const context: RouteContext = {
		boundaryRegistry: registry,
		areaLookup,
		namedLocationLookup,
		geographyResolver: createGeographyResolver({
			areaLookup,
			namedLocationLookup,
			locationProjectionStore: new LocationProjectionStore(
				compiled.inventory,
				() => {
					throw new Error("no member shards");
				},
				(shard) =>
					compiled.parentArtifacts.find(
						(artifact) =>
							artifact.crosswalkId === shard.crosswalkId,
					)!,
			),
		}),
	};
	const ask = (query: string) =>
		routeRequest(
			"GET",
			`/v1/locations/greater-manchester/parents?${query}`,
			context,
		);

	const unnamed = ask("geography=region&release=2025-12-en");
	assert.equal(unnamed.status, 400);
	assert.match(
		(unnamed.body as { detail: string }).detail,
		/local-authority-to-region-2025/,
	);
	assert.equal(ask("geography=region").status, 400);
	assert.equal(
		ask("geography=region&release=2025-12-en&via=nowhere").status,
		404,
	);

	const resolved = ask(
		"geography=region&release=2025-12-en&via=local-authority-to-region-2025",
	);
	assert.equal(resolved.status, 200);
	const data = ("data" in resolved.body && resolved.body.data) as {
		locationWithin: { id: string } | null;
		parents: {
			id: string;
			name: string;
			relation: string;
			parentMemberCount: number;
			members: { id: string }[];
		}[];
		unplaced: unknown[];
	};
	// One of the region's two authorities is a member: the location lies in
	// the region but does not cover it.
	assert.deepEqual(data.parents, [
		{
			id: "region/2025-12-en/E12000002",
			code: "E12000002",
			name: "North West",
			relation: "intersects",
			members: [
				{
					id: "localAuthority/2025-01-uk-lad/E08000001",
					code: "E08000001",
					name: "Greater Manchester",
				},
			],
			parentMemberCount: 2,
		},
	]);
	assert.equal(data.locationWithin?.id, "region/2025-12-en/E12000002");
	assert.deepEqual(data.unplaced, []);
});
