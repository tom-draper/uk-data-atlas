import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import {
	type AreaInventory,
	compileLookupManifest,
	areaIdentityTable,
	crosswalkTable,
	createAreaLookup,
	namedLocationMembersTable,
} from "@uk-data-atlas/areas";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "@uk-data-atlas/relationships";
import type { NamedLocationInventory } from "@uk-data-atlas/places";
import {
	characterize,
	startCharacterization,
	type CharacterizedRequest,
} from "./httpCharacterization";
import { dataCatalog, measureObservations } from "./routeFixtures";
import { testContext } from "./routeFixtures";

const fixturePath = fileURLToPath(
	new URL("./fixtures/bulk-export.csv", import.meta.url),
);
const bytes = statSync(fixturePath).size;

const measure = dataCatalog.measures.find(
	(candidate) => candidate.id === "small-area-fixture",
)!;
const source = measure.sources[0]!;
const formats = (["csv", "parquet"] as const).map((format) => ({
	format,
	artifact: `exports/fixture.${format}`,
	bytes,
	contentHash: "sha256:download",
	href: `/v1/exports/small-area-fixture?format=${format}`,
}));
const exportManifest = {
	schemaVersion: 1 as const,
	contentHash: "sha256:export-manifest",
	dataCatalogHash: dataCatalog.contentHash,
	fields: {},
	datasets: {},
	exports: [
		{
			id: "small-area-fixture",
			measureId: measure.id,
			datasetId: source.datasetId,
			periods: source.periods,
			sourceGeography: source.sourceGeography,
			format: "json" as const,
			artifact: "small-area-fixture",
			contentHash: measureObservations[0]!.contentHash,
			bytes: 123,
			href: "/v1/exports/small-area-fixture",
			recordCount: 2,
			recordCountByPeriod: { [source.periods[0]]: 2 },
			schema: {
				version: 1,
				layout: "periods" as const,
				recordType: "numeric" as const,
				fields: [],
			},
			provenance: {
				measure: `/v1/measures/${measure.id}`,
				datasets: [],
			},
			formats,
		},
		{
			id: "unbuilt-export",
			measureId: measure.id,
			datasetId: source.datasetId,
			periods: source.periods,
			sourceGeography: source.sourceGeography,
			format: "json" as const,
			artifact: "unbuilt-export",
			contentHash: "sha256:unbuilt",
			bytes: 1,
			href: "/v1/exports/unbuilt-export",
			recordCount: 0,
			recordCountByPeriod: {},
			schema: {
				version: 1,
				layout: "periods" as const,
				recordType: "numeric" as const,
				fields: [],
			},
			provenance: { measure: `/v1/measures/${measure.id}`, datasets: [] },
			formats: [
				{
					format: "csv" as const,
					artifact: "exports/missing.csv",
					bytes,
					contentHash: "sha256:missing",
					href: "/v1/exports/unbuilt-export?format=csv",
				},
			],
		},
	],
};
const exportFiles = new Map(
	formats.map((file) => [
		file.artifact,
		{ path: fixturePath, bytes, contentHash: file.contentHash },
	]),
);

const wards = {
	schemaVersion: 1 as const,
	contentHash: "sha256:wards",
	geography: "ward",
	boundaryRelease: "2025-05",
	codeProperty: "WD25CD",
	nameProperty: "WD25NM",
	areas: [
		{ code: "W05000001", name: "Bishopston", aliases: ["Llandeilo"] },
		{ code: "E05000001", name: 'Kings "Cross", North' },
	],
};
const overlap = {
	schemaVersion: 1,
	contentHash: "sha256:overlap",
	id: "ward-to-lad-area-overlap",
	method: "area-overlap",
	quality: "derived",
	weighting: {
		status: "provided",
		basis: "area",
		normalisation: "per-source",
	},
	from: { geography: "ward", boundaryRelease: "2025-05" },
	to: { geography: "localAuthority", boundaryRelease: "2025-05" },
	records: [
		{
			source: {
				code: "E05000001",
				labels: ["Kings Cross"],
				areaM2: 10,
				coverage: 1,
			},
			targets: [
				{
					code: "E06000001",
					labels: ["Example"],
					weight: 1,
					overlapAreaM2: 10,
					sourceShare: 1,
					targetShare: 0.1,
				},
			],
		},
	],
} as unknown as CrosswalkArtifact;
const locations: NamedLocationInventory = {
	schemaVersion: 1,
	contentHash: "sha256:locations",
	source: {
		artifact: "data/datasets/gazetteer.core.json",
		gazetteerVersion: 1,
	},
	locations: [
		{
			id: "example",
			label: "Example",
			kind: "editorial-grouping",
			definitionRevision: 1,
			memberGeography: "localAuthority",
			memberCodes: ["E06000001"],
			validity: { from: null, to: null },
			bbox: [0, 0, 1, 1],
		},
	],
};
const lookupManifest = compileLookupManifest([
	areaIdentityTable({
		geography: wards.geography,
		boundaryRelease: wards.boundaryRelease,
		artifact: "areas/ward/2025-05.json",
		contentHash: wards.contentHash,
		areas: wards.areas,
	}),
	crosswalkTable(overlap, "crosswalks/ward-to-lad-area-overlap.json"),
	namedLocationMembersTable(locations, "named-locations.json"),
]);
const areaInventory = {
	schemaVersion: 1,
	contentHash: "sha256:areas",
	boundaryRegistryHash: "sha256:registry",
	releases: [
		{
			id: wards.boundaryRelease,
			geography: wards.geography,
			status: "available",
			recordCount: 2,
			artifact: "areas/ward/2025-05.json",
			contentHash: wards.contentHash,
			codeProperty: "WD25CD",
			nameProperty: "WD25NM",
		},
	],
} as AreaInventory;
const crosswalkInventory = {
	schemaVersion: 1,
	contentHash: "sha256:crosswalks",
	crosswalks: [
		{
			id: overlap.id,
			artifact: "crosswalks/ward-to-lad-area-overlap.json",
		},
	],
} as unknown as CrosswalkInventory;
const registry = {
	schemaVersion: 1 as const,
	contentHash: "sha256:registry",
	releases: [],
};

const context = testContext({
	boundaryRegistry: registry,
	dataCatalog,
	measureObservations,
	exportManifest,
	exportFiles,
	areaInventory,
	areaLookup: createAreaLookup([wards]),
	crosswalkInventory,
	crosswalkLookup: new Map([[overlap.id, overlap]]),
	namedLocationInventory: locations,
	lookupManifest,
});
const drifted = testContext({
	boundaryRegistry: registry,
	dataCatalog,
	measureObservations: [],
	exportManifest,
	exportFiles: new Map(),
	areaInventory,
	areaLookup: createAreaLookup([{ ...wards, areas: [wards.areas[0]!] }]),
	crosswalkInventory,
	crosswalkLookup: new Map([[overlap.id, overlap]]),
	namedLocationInventory: locations,
	lookupManifest,
});
const bare = testContext({ boundaryRegistry: registry });

const methods = (path: string): CharacterizedRequest[] => [
	{
		path,
		method: "OPTIONS",
		headers: {
			origin: "https://example.test",
			"access-control-request-method": "GET",
		},
	},
	...["POST", "PUT", "PATCH", "DELETE"].map((method) => ({ path, method })),
];

const exportPaths = [
	"/v1/exports",
	"/v1/exports/small-area-fixture",
	"/v1/exports/small-area-fixture?format=json",
	"/v1/exports/small-area-fixture?format=csv",
	"/v1/exports/small-area-fixture?format=parquet",
	"/v1/exports/small-area-fixture?format=xlsx",
	"/v1/exports/small-area-fixture?format=",
	"/v1/exports/small-area-fixture?format=csv&format=json",
	"/v1/exports/small-area-fixture?unexpected=1",
	"/v1/exports/unbuilt-export?format=csv",
	"/v1/exports/unbuilt-export",
	"/v1/exports/missing",
	"/v1/exports/missing?format=xlsx",
	"/v1/exports/small-area-fixture/",
	"/v1/exports/",
	"/v1/exports/Small-Area-Fixture",
	"/v1/exports/small%2Darea-fixture",
	"/v1/exports/small-area-fixture/extra",
	"/v1/exports?format=csv",
	`/v1/exports/${"x".repeat(150)}`,
	"/v1/exports/%E0%A4%A",
];
const lookupPaths = [
	"/v1/lookups",
	"/v1/lookups/areas-ward-2025-05",
	"/v1/lookups/areas-ward-2025-05?format=csv",
	"/v1/lookups/areas-ward-2025-05?format=ndjson",
	"/v1/lookups/crosswalk-ward-to-lad-area-overlap?format=ndjson",
	"/v1/lookups/named-location-members",
	"/v1/lookups/named-location-members?format=parquet",
	"/v1/lookups/named-location-members?format=",
	"/v1/lookups/named-location-members?format=csv&format=ndjson",
	"/v1/lookups/areas-ward-2025-05?unexpected=1",
	"/v1/lookups/unknown",
	"/v1/lookups/unknown?format=json",
	"/v1/lookups/areas-ward-2025-05/",
	"/v1/lookups/",
	"/v1/lookups/Areas-Ward-2025-05",
	"/v1/lookups/areas%2Dward-2025-05",
	"/v1/lookups/areas-ward-2025-05/extra",
	"/v1/lookups?format=csv",
	`/v1/lookups/${"x".repeat(150)}`,
	"/v1/lookups/%E0%A4%A",
];

test("exports keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, context);
	const first = await send({ path: "/v1/exports/small-area-fixture" });
	const etag =
		first.headers.find((line) => line.startsWith("etag: "))?.slice(6) ?? "";
	const requests: CharacterizedRequest[] = [
		...exportPaths.map((path) => ({ path })),
		{ path: "/v1/exports", method: "HEAD" },
		{ path: "/v1/exports/small-area-fixture", method: "HEAD" },
		{ path: "/v1/exports/small-area-fixture?format=csv", method: "HEAD" },
		{ path: "/v1/exports/missing", method: "HEAD" },
		{
			path: "/v1/exports/small-area-fixture",
			headers: { "if-none-match": etag },
		},
		{
			path: "/v1/exports/small-area-fixture?format=csv",
			headers: { "accept-encoding": "gzip" },
		},
		{
			path: "/v1/exports/small-area-fixture?format=csv",
			headers: { range: "bytes=0-9" },
		},
		{ path: "/v1/exports", headers: { origin: "https://example.test" } },
		...methods("/v1/exports"),
		...methods("/v1/exports/small-area-fixture"),
		...methods("/v1/exports/missing"),
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("exports keep their refusals without a built manifest or files", async (t) => {
	for (const [name, held] of [
		["bare", bare],
		["drifted", drifted],
	] as const) {
		const send = await startCharacterization(t, held);
		expect({
			name,
			responses: await characterize(send, [
				{ path: "/v1/exports" },
				{ path: "/v1/exports/small-area-fixture" },
				{ path: "/v1/exports/small-area-fixture?format=csv" },
				{ path: "/v1/exports/small-area-fixture?format=xlsx" },
				{ path: "/v1/exports/missing" },
			]),
		}).toMatchSnapshot();
	}
});

test("lookups keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, context);
	const first = await send({ path: "/v1/lookups/areas-ward-2025-05" });
	const etag =
		first.headers.find((line) => line.startsWith("etag: "))?.slice(6) ?? "";
	const requests: CharacterizedRequest[] = [
		...lookupPaths.map((path) => ({ path })),
		{ path: "/v1/lookups", method: "HEAD" },
		{ path: "/v1/lookups/areas-ward-2025-05", method: "HEAD" },
		{ path: "/v1/lookups/unknown", method: "HEAD" },
		{
			path: "/v1/lookups/areas-ward-2025-05",
			headers: { "if-none-match": etag },
		},
		{
			path: "/v1/lookups/areas-ward-2025-05",
			headers: { "accept-encoding": "gzip" },
		},
		{ path: "/v1/lookups", headers: { origin: "https://example.test" } },
		...methods("/v1/lookups"),
		...methods("/v1/lookups/areas-ward-2025-05"),
		...methods("/v1/lookups/unknown"),
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("lookups keep their refusals without a manifest or matching source", async (t) => {
	for (const [name, held] of [
		["bare", bare],
		["drifted", drifted],
	] as const) {
		const send = await startCharacterization(t, held);
		expect({
			name,
			responses: await characterize(send, [
				{ path: "/v1/lookups" },
				{ path: "/v1/lookups/areas-ward-2025-05" },
				{ path: "/v1/lookups/areas-ward-2025-05?format=json" },
				{ path: "/v1/lookups/unknown" },
			]),
		}).toMatchSnapshot();
	}
});
