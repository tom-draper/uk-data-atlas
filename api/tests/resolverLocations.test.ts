import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import type { CrosswalkInventory } from "../src/crosswalkInventory";
import type { LocationProjectionStore } from "../src/locationProjections";
import type {
	NamedLocation,
	NamedLocationInventory,
} from "../src/namedLocations";
import { CatalogueResolver } from "../src/resolver/catalogue";
import { LocationsResolver } from "../src/resolver/locations";

const location = (
	id: string,
	memberGeography: string,
	memberCodes: string[],
): NamedLocation => ({
	id,
	label: id,
	kind: "editorial-grouping",
	definitionRevision: 1,
	memberGeography,
	memberCodes,
	validity: { from: null, to: null },
	bbox: [-3, 53, -2, 54],
});

const namedLocationInventory: NamedLocationInventory = {
	schemaVersion: 1,
	contentHash: "sha256:locations",
	source: {
		artifact: "data/datasets/gazetteer.core.json",
		gazetteerVersion: 1,
	},
	locations: [
		location("north-west", "localAuthority", ["E08000001", "E08000002"]),
		location("greater-manchester", "localAuthority", ["E08000001"]),
		location("bolton-wards", "ward", ["E08000001"]),
	],
};

const summary = (
	id: string,
	from: [string, string],
	to: [string, string],
): CrosswalkInventory["crosswalks"][number] => ({
	id,
	from: { geography: from[0], boundaryRelease: from[1] },
	to: { geography: to[0], boundaryRelease: to[1] },
	method: "clean-containment",
	quality: "publisher-supplied",
	weighting: { status: "not-applicable" },
	recordCount: 1,
	artifact: `crosswalks/${id}.json`,
	contentHash: `sha256:${id}`,
});

const crosswalkInventory: CrosswalkInventory = {
	schemaVersion: 1,
	contentHash: "sha256:crosswalks",
	crosswalks: [
		summary("ward-to-lad-b", ["ward", "2024"], ["localAuthority", "2024"]),
		summary("ward-to-lad-a", ["ward", "2024"], ["localAuthority", "2024"]),
		summary(
			"ward-2023-to-lad",
			["ward", "2023"],
			["localAuthority", "2024"],
		),
		summary(
			"lad-to-region",
			["localAuthority", "2024"],
			["region", "2024"],
		),
	],
};

const catalogue = new CatalogueResolver({ crosswalkInventory });

test("indexes named locations by member geography and code, in id order", () => {
	const resolver = new LocationsResolver(
		{ namedLocationInventory },
		catalogue,
	);

	// Membership is by code within a geography, whatever the release.
	assert.deepEqual(
		resolver
			.namedLocationsForArea({
				geography: "localAuthority",
				boundaryRelease: "any-release",
				code: "E08000001",
			})
			.map(({ id }) => id),
		["greater-manchester", "north-west"],
	);
	// The same code in another geography is another area.
	assert.deepEqual(
		resolver
			.namedLocationsForArea({
				geography: "ward",
				boundaryRelease: "2024",
				code: "E08000001",
			})
			.map(({ id }) => id),
		["bolton-wards"],
	);
	assert.deepEqual(
		resolver.namedLocationsForArea({
			geography: "localAuthority",
			boundaryRelease: "2024",
			code: "E08000999",
		}),
		[],
	);
});

test("selects projection shards by the crosswalk end that holds the members", () => {
	const shards = [
		{ crosswalkId: "lad-to-region" },
		{ crosswalkId: "ward-to-lad-a" },
		{ crosswalkId: "unpublished" },
	];
	const store = {
		memberProjectionShards: () => shards,
		parentProjectionShards: () => shards,
	} as unknown as LocationProjectionStore;
	const resolver = new LocationsResolver(
		{ locationProjectionStore: store },
		catalogue,
	);

	// Member shards project onto the members, so the crosswalk ends there.
	assert.deepEqual(
		resolver
			.locationMemberProjectionShards("localAuthority")
			.map(({ shard, summary: found }) => [shard.crosswalkId, found.id]),
		[["ward-to-lad-a", "ward-to-lad-a"]],
	);
	// Parent shards start from the members, so the crosswalk starts there.
	assert.deepEqual(
		resolver
			.locationParentProjectionShards("localAuthority")
			.map(({ shard }) => shard.crosswalkId),
		["lad-to-region"],
	);
	// No crosswalk with a shard ends on wards.
	assert.deepEqual(resolver.locationMemberProjectionShards("ward"), []);
});

test("lists crosswalks onto member areas from one exact release, in id order", () => {
	const resolver = new LocationsResolver({}, catalogue);

	assert.deepEqual(
		resolver
			.crosswalksToLocationMembers("ward", "2024", "localAuthority")
			.map(({ id }) => id),
		["ward-to-lad-a", "ward-to-lad-b"],
	);
	assert.deepEqual(
		resolver.crosswalksToLocationMembers("ward", "2024", "region"),
		[],
	);
});

test("counts a location's resolved members in each release of its geography", () => {
	const areaLookup = createAreaLookup(
		[
			["localAuthority", "2024", ["E08000001", "E08000002"]],
			["localAuthority", "2019", ["E08000001"]],
			["ward", "2024", ["E08000001"]],
		].map(([geography, boundaryRelease, codes]) => ({
			schemaVersion: 1 as const,
			contentHash: `sha256:${geography}-${boundaryRelease}`,
			geography: geography as string,
			boundaryRelease: boundaryRelease as string,
			codeProperty: "CD",
			nameProperty: "NM",
			areas: (codes as string[]).map((code) => ({ code, name: code })),
		})),
	);
	const resolver = new LocationsResolver({ areaLookup }, catalogue);

	assert.deepEqual(
		resolver.locationReleaseViews("localAuthority", [
			"E08000001",
			"E08000002",
			"E08000003",
		]),
		[
			{
				geography: "localAuthority",
				boundaryRelease: "2019",
				resolvedMemberCount: 1,
			},
			{
				geography: "localAuthority",
				boundaryRelease: "2024",
				resolvedMemberCount: 2,
			},
		],
	);
});

test("stays empty without location inputs", () => {
	const resolver = new LocationsResolver({}, new CatalogueResolver({}));
	const identity = {
		geography: "localAuthority",
		boundaryRelease: "2024",
		code: "E08000001",
	};

	assert.equal(resolver.hasNamedLocationInventory(), false);
	assert.equal(resolver.hasLocationProjectionStore(), false);
	assert.deepEqual(resolver.namedLocations(), []);
	assert.deepEqual(resolver.namedLocationsForArea(identity), []);
	assert.deepEqual(
		resolver.locationMemberProjectionShards("localAuthority"),
		[],
	);
	assert.deepEqual(
		resolver.locationParentCrosswalks("localAuthority", "2024"),
		[],
	);
	assert.deepEqual(
		resolver.locationReleaseViews("localAuthority", ["E08000001"]),
		[],
	);
	assert.equal(
		resolver.reconcileMembers(
			"localAuthority",
			"2024",
			["E08000001"],
			new Set(),
		),
		undefined,
	);
});

test("finds catalogue summaries by id and artifact", () => {
	const resolver = new CatalogueResolver({
		crosswalkInventory,
		namedLocationInventory,
		areaInventory: {
			schemaVersion: 1,
			contentHash: "sha256:areas",
			boundaryRegistryHash: "sha256:registry",
			releases: [
				{
					id: "2024",
					geography: "ward",
					status: "available",
					recordCount: 1,
					artifact: "areas/ward-2024.json",
					contentHash: "sha256:ward-2024",
					codeProperty: "WD24CD",
					nameProperty: "WD24NM",
				},
				{
					id: "2019",
					geography: "ward",
					status: "not-compiled",
					reason: "No source geometry.",
				},
			],
		},
	});

	assert.equal(
		resolver.crosswalkSummary("lad-to-region")?.to.geography,
		"region",
	);
	assert.equal(
		resolver.crosswalkSummaryForArtifact("crosswalks/ward-to-lad-a.json")
			?.id,
		"ward-to-lad-a",
	);
	assert.equal(resolver.crosswalkSummary("missing"), undefined);
	assert.equal(
		resolver.areaIdentityRelease("ward", "2019")?.status,
		"not-compiled",
	);
	assert.equal(
		resolver.areaIdentityReleaseForArtifact("areas/ward-2024.json")?.id,
		"2024",
	);
	assert.deepEqual(resolver.namedLocationMembershipInventory(), {
		contentHash: "sha256:locations",
		locations: namedLocationInventory.locations,
	});
	assert.equal(
		new CatalogueResolver({}).namedLocationMembershipInventory(),
		undefined,
	);
	assert.deepEqual(new CatalogueResolver({}).crosswalkSummaries(), []);
});
