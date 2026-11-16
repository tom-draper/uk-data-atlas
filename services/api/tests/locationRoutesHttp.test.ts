import { expect, test } from "vitest";
import { createGeographyServices } from "@uk-data-atlas/atlas-loader";
import { createGeographyResolver } from "@uk-data-atlas/atlas-loader";
import {
	compileLocationProjections,
	LocationProjectionStore,
} from "@uk-data-atlas/places";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "@uk-data-atlas/relationships";
import type { RouteContext } from "../src/runtime/index.ts";
import {
	characterize,
	startCharacterization,
	type CharacterizedRequest,
} from "./httpCharacterization";
import {
	areaLookup,
	containmentCrosswalk,
	crosswalkInventory,
	crosswalkLookup,
	namedLocationAreaLookup,
	namedLocationInventory,
	registry,
	testContext,
} from "./routeFixtures";

const toRegion = {
	...containmentCrosswalk,
	contentHash: "sha256:authority-to-region",
	id: "local-authority-to-region-2025",
	method: "official-lookup" as const,
	relationshipPurpose: "membership" as const,
	weighting: { status: "not-provided" as const },
	from: { geography: "localAuthority", boundaryRelease: "2025-01-uk-lad" },
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
const summary = (artifact: typeof containmentCrosswalk) => ({
	id: artifact.id,
	from: artifact.from,
	to: artifact.to,
	method: artifact.method,
	quality: artifact.quality,
	...("relationshipPurpose" in artifact
		? { relationshipPurpose: artifact.relationshipPurpose }
		: {}),
	weighting: artifact.weighting,
	recordCount: artifact.records.length,
	artifact: `crosswalks/${artifact.id}.json`,
	contentHash: artifact.contentHash,
});
const inventory: CrosswalkInventory = {
	...crosswalkInventory,
	crosswalks: [
		...crosswalkInventory.crosswalks,
		summary(containmentCrosswalk),
		summary(toRegion),
	],
};
const first = {
	...namedLocationInventory.locations[0]!,
	geometry: {
		boundaryRelease: "2025-01-uk-lad",
		bbox: [-2.5, 53.3, -2, 53.7] as [number, number, number, number],
		geometry: {
			type: "MultiPolygon" as const,
			coordinates: [
				[
					[
						[-2.5, 53.3],
						[-2, 53.3],
						[-2, 53.7],
						[-2.5, 53.3],
					],
				],
			],
		},
	},
};
const second = { ...first, id: "second", label: "Second area" };
const third = {
	...namedLocationInventory.locations[0]!,
	id: "greater-manchester-historic",
	label: "Greater Manchester",
	kind: "county" as const,
};
const locations = [first, second, third];
const namedLocations = {
	...namedLocationInventory,
	locations,
};
const projections = compileLocationProjections(
	namedLocations,
	inventory,
	[...crosswalkLookup.values(), containmentCrosswalk, toRegion],
	areaLookup,
);
const context: RouteContext = {
	...testContext({
		geographyInventory: undefined,
		areaLookup: namedLocationAreaLookup,
		crosswalkInventory: inventory,
		crosswalkLookup: new Map<string, CrosswalkArtifact>([
			...crosswalkLookup,
			[containmentCrosswalk.id, containmentCrosswalk],
			[toRegion.id, toRegion],
		]),
		namedLocationInventory: namedLocations,
		namedLocationLookup: new Map(locations.map((item) => [item.id, item])),
	}),
	boundaryRegistry: registry,
};
const projected: RouteContext = {
	...context,
	areaValidation: createGeographyServices({}).validation,
	postcodes: createGeographyServices({}).postcodes,
	geographyResolver: createGeographyResolver({
		areaLookup: namedLocationAreaLookup,
		crosswalkInventory: inventory,
		crosswalkLookup: new Map<string, CrosswalkArtifact>([
			[containmentCrosswalk.id, containmentCrosswalk],
			[toRegion.id, toRegion],
		]),
		namedLocationLookup: new Map(locations.map((item) => [item.id, item])),
		locationProjectionStore: new LocationProjectionStore(
			projections.inventory,
			(shard) =>
				projections.artifacts.find(
					(artifact) => artifact.crosswalkId === shard.crosswalkId,
				)!,
			(shard) =>
				projections.parentArtifacts.find(
					(artifact) => artifact.crosswalkId === shard.crosswalkId,
				)!,
		),
	}),
};

const ID = "greater-manchester";
const lookups = (id: string): string[] => [
	`/v1/locations/${id}`,
	`/v1/locations/${id}?include=capabilities`,
	`/v1/locations/${id}?include=geometry`,
	`/v1/locations/${id}?include=nope`,
	`/v1/locations/${id}?asOf=2024-01-01`,
	`/v1/locations/${id}?asOf=soon`,
	`/v1/locations/${id}/geometry`,
	`/v1/locations/${id}/members`,
	`/v1/locations/${id}/members?release=2025-01-uk-lad`,
	`/v1/locations/${id}/members?release=2025-01-uk-lad&asOf=2024-01-01`,
	`/v1/locations/${id}/members?release=2025-01-uk-lad&limit=1`,
	`/v1/locations/${id}/members?release=2025-01-uk-lad&limit=0`,
	`/v1/locations/${id}/members?release=nowhere`,
	`/v1/locations/${id}/members?geography=ward&release=2025-01-en-ward`,
	`/v1/locations/${id}/members?geography=ward&release=2025-01-en-ward&via=ward-to-local-authority-2025`,
	`/v1/locations/${id}/members?geography=ward&release=2025-01-en-ward&via=nowhere`,
	`/v1/locations/${id}/members?unexpected=1`,
	`/v1/locations/${id}/parents`,
	`/v1/locations/${id}/parents?geography=region`,
	`/v1/locations/${id}/parents?geography=region&release=2025-12-en`,
	`/v1/locations/${id}/parents?geography=region&release=2025-12-en&via=local-authority-to-region-2025`,
	`/v1/locations/${id}/parents?geography=region&release=2025-12-en&via=nowhere`,
	`/v1/locations/${id}/comparison?from=2020-01-01&to=2026-01-01`,
	`/v1/locations/${id}/comparison?from=2026-01-01&to=2020-01-01`,
	`/v1/locations/${id}/comparison?from=1974&to=2026-01-01`,
	`/v1/locations/${id}/comparison?from=2020-01-01`,
	`/v1/locations/${id}/comparison`,
];

const sweep = (ids: string[]): CharacterizedRequest[] => [
	...ids.flatMap((id) => lookups(id).map((path) => ({ path }))),
];

test("named location reads keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, context);
	const requests: CharacterizedRequest[] = [
		{ path: "/v1/locations" },
		{ path: "/v1/locations", method: "HEAD" },
		{ path: "/v1/locations?q=greater" },
		{ path: "/v1/locations?q=nowhere" },
		{ path: "/v1/locations?limit=1" },
		{ path: "/v1/locations?limit=1&cursor=bad" },
		{ path: "/v1/locations?limit=0" },
		{ path: "/v1/locations?limit=1000" },
		{ path: "/v1/locations?kind=county" },
		{ path: "/v1/locations?kind=nope" },
		{ path: "/v1/locations?asOf=2024-01-01" },
		{ path: "/v1/locations?asOf=soon" },
		{ path: "/v1/locations?unexpected=1" },
		{
			path: "/v1/locations",
			headers: {
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		{ path: "/v1/locations", headers: { "if-none-match": '"unknown"' } },
		{ path: "/v1/locations/" },
		{ path: "/v1/Locations" },
		{ path: "/v1/locations/alternatives" },
		{ path: "/v1/locations/alternatives?q=greater%20manchester" },
		{ path: "/v1/locations/alternatives?q=GREATER%20MANCHESTER" },
		{ path: "/v1/locations/alternatives?q=nowhere" },
		{ path: "/v1/locations/alternatives?q=" },
		{ path: "/v1/locations/alternatives?q=a&q=b" },
		{ path: "/v1/locations/alternatives", method: "HEAD" },
		{ path: "/v1/locations/alternatives/" },
		{ path: "/v1/locations/alternatives/extra" },
		...sweep([ID, "second", "nowhere"]),
		{ path: `/v1/locations/${ID}`, method: "HEAD" },
		{ path: `/v1/locations/${ID}/members`, method: "HEAD" },
		{
			path: `/v1/locations/${ID}`,
			headers: {
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		{
			path: `/v1/locations/${ID}`,
			headers: { "if-none-match": '"unknown"' },
		},
		{ path: `/v1/locations/${ID}/` },
		{ path: `/v1/locations/${ID.toUpperCase()}` },
		{ path: `/v1/locations/${ID}/members/` },
		{ path: `/v1/locations/${ID}/extra` },
		{ path: `/v1/locations/${ID}/members/extra` },
		{ path: "/v1/locations/%E0%A4%A" },
		{ path: "/v1/locations/%E0%A4%A/members" },
		{ path: "/v1/locations/a.b" },
		{ path: "/v1/locations/.." },
		{ path: "/v1/locations/bad%20id" },
		{ path: `/v1/locations/${"x".repeat(150)}` },
		{ path: `/v1/locations/${"x".repeat(150)}/geometry` },
		{ path: "/v1/locations", method: "POST", body: "{}" },
		{ path: "/v1/locations", method: "PUT" },
		{ path: `/v1/locations/${ID}`, method: "POST", body: "{}" },
		{ path: `/v1/locations/${ID}/members`, method: "DELETE" },
		{ path: `/v1/locations/${ID}/geometry`, method: "PATCH" },
		{ path: "/v1/locations/alternatives", method: "POST", body: "{}" },
		{
			path: "/v1/locations",
			method: "OPTIONS",
			headers: {
				origin: "https://example.test",
				"access-control-request-method": "GET",
			},
		},
		{
			path: `/v1/locations/${ID}/parents`,
			method: "OPTIONS",
			headers: {
				origin: "https://example.test",
				"access-control-request-method": "GET",
			},
		},
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("named locations with compiled projections keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, projected);
	const requests = sweep([ID]).concat([
		{ path: `/v1/locations/${ID}?include=capabilities` },
	]);
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("location routes answer without the locations they read", async (t) => {
	const bare = testContext({ areaLookup });
	const send = await startCharacterization(t, bare);
	const requests: CharacterizedRequest[] = [
		{ path: "/v1/locations" },
		{ path: "/v1/locations/alternatives?q=greater" },
		{ path: `/v1/locations/${ID}` },
		{ path: `/v1/locations/${ID}/geometry` },
		{ path: `/v1/locations/${ID}/members` },
		{ path: `/v1/locations/${ID}/parents` },
		{
			path: `/v1/locations/${ID}/comparison?from=2020-01-01&to=2026-01-01`,
		},
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});
