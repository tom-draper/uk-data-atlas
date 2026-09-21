import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { type AreaInventory, createAreaLookup } from "../src/areaInventory";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "../src/crosswalkInventory";
import {
	areaIdentityTable,
	compileLookupManifest,
	crosswalkTable,
	namedLocationMembersTable,
	renderLookup,
} from "../src/lookupExports";
import type { NamedLocationInventory } from "../src/namedLocations";
import { route } from "../src/routes";
import type { RouteContext } from "../src/routing";

const wards = {
	schemaVersion: 1 as const,
	contentHash: "sha256:wards",
	geography: "ward",
	boundaryRelease: "2025-05",
	codeProperty: "WD25CD",
	nameProperty: "WD25NM",
	areas: [
		{
			code: "W05000001",
			name: "Bishopston",
			aliases: ["Llandeilo Ferwallt"],
		},
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
					weight: 0.75,
					overlapAreaM2: 7.5,
					sourceShare: 0.75,
					targetShare: 0.1,
				},
				{
					code: "E06000002",
					labels: ["Other"],
					weight: 0.25,
					overlapAreaM2: 2.5,
					sourceShare: 0.25,
					targetShare: 0.05,
				},
			],
		},
	],
} as unknown as CrosswalkArtifact;

const locations: NamedLocationInventory = {
	schemaVersion: 1,
	contentHash: "sha256:locations",
	source: {
		artifact: "data/precompiled/gazetteer.core.json",
		gazetteerVersion: 1,
	},
	locations: [
		{
			id: "example",
			label: "Example",
			kind: "editorial-grouping",
			definitionRevision: 1,
			memberGeography: "localAuthority",
			memberCodes: ["E06000001", "E06000002"],
			validity: { from: null, to: null },
			bbox: [0, 0, 1, 1],
		},
	],
};

const tables = () => [
	areaIdentityTable({
		geography: wards.geography,
		boundaryRelease: wards.boundaryRelease,
		artifact: "areas/ward/2025-05.json",
		contentHash: wards.contentHash,
		areas: wards.areas,
	}),
	crosswalkTable(overlap, "crosswalks/ward-to-lad-area-overlap.json"),
	namedLocationMembersTable(locations, "named-locations.json"),
];

test("renders lookups as CSV and NDJSON with arrays joined and quoting only where needed", () => {
	const [areas, crosswalk, members] = tables();
	assert.equal(
		renderLookup(areas, "csv").body,
		[
			"geography,boundaryRelease,code,name,aliases",
			"ward,2025-05,W05000001,Bishopston,Llandeilo Ferwallt",
			'ward,2025-05,E05000001,"Kings ""Cross"", North",',
			"",
		].join("\n"),
	);
	assert.deepEqual(
		renderLookup(areas, "ndjson")
			.body.trim()
			.split("\n")
			.map((line) => JSON.parse(line).aliases),
		[["Llandeilo Ferwallt"], []],
	);
	assert.deepEqual(
		renderLookup(crosswalk, "ndjson")
			.body.trim()
			.split("\n")
			.map((line) => {
				const row = JSON.parse(line);
				return [row.sourceCode, row.targetCode, row.weight];
			}),
		[
			["E05000001", "E06000001", 0.75],
			["E05000001", "E06000002", 0.25],
		],
	);
	assert.equal(members.rows.length, 2);
});

test("lists each lookup's columns, rows and the hash of every rendered format", () => {
	const manifest = compileLookupManifest(tables());
	assert.deepEqual(
		manifest.lookups.map((lookup) => [lookup.id, lookup.rowCount]),
		[
			["areas-ward-2025-05", 2],
			["crosswalk-ward-to-lad-area-overlap", 2],
			["named-location-members", 2],
		],
	);
	const [areas] = manifest.lookups;
	const csv = renderLookup(tables()[0], "csv").body;
	assert.deepEqual(areas.formats.csv, {
		contentType: "text/csv; charset=utf-8",
		bytes: Buffer.byteLength(csv),
		contentHash: `sha256:${createHash("sha256").update(csv).digest("hex")}`,
		href: "/v1/lookups/areas-ward-2025-05?format=csv",
	});
	assert.deepEqual(
		areas.columns.map((column) => [column.name, column.required]),
		[
			["geography", true],
			["boundaryRelease", true],
			["code", true],
			["name", true],
			["aliases", false],
		],
	);
	const broken = tables()[1];
	broken.rows[0].weight = null;
	assert.throws(
		() => compileLookupManifest([broken]),
		/required column weight is empty in some rows/,
	);
});

test("serves a lookup only when it renders the bytes its manifest lists", () => {
	const lookupManifest = compileLookupManifest(tables());
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
	const context = (areas = wards.areas): RouteContext => ({
		boundaryRegistry: {
			schemaVersion: 1,
			contentHash: "sha256:registry",
			releases: [],
		},
		areaInventory,
		areaLookup: createAreaLookup([{ ...wards, areas }]),
		crosswalkInventory,
		crosswalkLookup: new Map([[overlap.id, overlap]]),
		namedLocationInventory: locations,
		lookupManifest,
	});

	const listed = route("GET", "/v1/lookups", context());
	assert.equal(listed.status, 200);
	assert.equal(
		"data" in listed.body &&
			(listed.body.data as { lookups: unknown[] }).lookups.length,
		3,
	);

	const csv = route("GET", "/v1/lookups/areas-ward-2025-05", context());
	assert.equal(csv.status, 200);
	assert.equal(
		csv.representation?.body,
		renderLookup(tables()[0], "csv").body,
	);
	assert.equal(
		csv.representation?.headers?.["content-disposition"],
		'attachment; filename="areas-ward-2025-05.csv"',
	);
	const ndjson = route(
		"GET",
		"/v1/lookups/crosswalk-ward-to-lad-area-overlap?format=ndjson",
		context(),
	);
	assert.equal(
		ndjson.representation?.contentType,
		"application/x-ndjson; charset=utf-8",
	);

	assert.equal(
		route(
			"GET",
			"/v1/lookups/areas-ward-2025-05",
			context([wards.areas[0]]),
		).status,
		503,
	);
	assert.equal(route("GET", "/v1/lookups/unknown", context()).status, 404);
	assert.equal(
		route(
			"GET",
			"/v1/lookups/named-location-members?format=parquet",
			context(),
		).status,
		400,
	);
});
