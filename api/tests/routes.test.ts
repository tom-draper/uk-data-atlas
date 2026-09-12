import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import {
	AreaGeometryCache,
	type GeometrySourceLookup,
} from "../src/areaGeometry";
import { route, type CrosswalkLookup } from "../src/routes";
import type { AtlasRelease } from "../src/atlasRelease";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "../src/crosswalkInventory";
import type { GeographyInventory } from "../src/geographyInventory";
import type { RelationshipCandidateInventory } from "../src/relationshipCandidates";
import {
	createNamedLocationLookup,
	type NamedLocationInventory,
} from "../src/namedLocations";
import type { ValidationReport } from "../src/validationReport";

const registry: BoundaryRegistry = {
	schemaVersion: 1,
	contentHash: "sha256:registry",
	releases: [
		{
			id: "2025-01-en-ward",
			geography: "ward",
			title: "Ward boundaries",
			coverage: { countries: ["GB-ENG"] },
			source: {
				publisher: "ONS",
				url: "https://example.com/source",
				licence: { name: "Open Government Licence" },
			},
			metadataHash: "sha256:metadata",
		},
	],
};

const geographyInventory: GeographyInventory = {
	schemaVersion: 1,
	contentHash: "sha256:geography",
	boundaryRegistryHash: "sha256:registry",
	releases: [],
	geographies: [],
};

const areaLookup = createAreaLookup([
	{
		schemaVersion: 1,
		contentHash: "sha256:areas",
		geography: "ward",
		boundaryRelease: "2025-01-en-ward",
		codeProperty: "WD25CD",
		nameProperty: "WD25NM",
		areas: [
			{
				code: "E05000001",
				name: "Example ward",
				aliases: ["Enghraifft ward"],
			},
			{ code: "E05000002", name: "Other ward" },
		],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:local-authority-areas",
		geography: "localAuthority",
		boundaryRelease: "2025-01-uk-lad",
		codeProperty: "LAD25CD",
		nameProperty: "LAD25NM",
		areas: [
			{ code: "E08000001", name: "Greater Manchester", aliases: ["GM"] },
		],
	},
]);

const crosswalkArtifact: CrosswalkArtifact = {
	schemaVersion: 1,
	contentHash: "sha256:crosswalk-artifact",
	id: "constituency-2010-to-2024",
	method: "official-lookup",
	quality: "publisher-supplied",
	weighting: { status: "not-provided" },
	from: { geography: "constituency", boundaryRelease: "2010" },
	to: { geography: "constituency", boundaryRelease: "2024-07-uk-bgc" },
	provenance: { input: "lookup.geojson", inputHash: "sha256:input" },
	validation: {
		sourceNameConflicts: [],
		endpoints: {
			from: {
				status: "not-available",
				reason: "No compiled area release is available for constituency/2010.",
			},
			to: {
				status: "verified",
				availableAreaCount: 650,
				referencedCodeCount: 650,
			},
		},
	},
	records: [
		{
			source: { code: "E14000001", labels: ["Old seat"] },
			targets: [{ code: "E14001001", labels: ["New seat A"] }],
		},
	],
};

const crosswalkInventory: CrosswalkInventory = {
	schemaVersion: 1,
	contentHash: "sha256:crosswalk-inventory",
	crosswalks: [
		{
			id: crosswalkArtifact.id,
			from: crosswalkArtifact.from,
			to: crosswalkArtifact.to,
			method: crosswalkArtifact.method,
			quality: crosswalkArtifact.quality,
			weighting: crosswalkArtifact.weighting,
			recordCount: crosswalkArtifact.records.length,
			artifact: `crosswalks/${crosswalkArtifact.id}.json`,
			contentHash: crosswalkArtifact.contentHash,
		},
	],
};

const containmentCrosswalk: CrosswalkArtifact = {
	...crosswalkArtifact,
	contentHash: "sha256:containment-artifact",
	id: "ward-to-local-authority-2025",
	method: "clean-containment",
	weighting: { status: "not-applicable" },
	from: { geography: "ward", boundaryRelease: "2025-01-en-ward" },
	to: { geography: "localAuthority", boundaryRelease: "2025-01-uk-lad" },
	records: [
		{
			source: { code: "E05000001", labels: ["Example ward"] },
			targets: [{ code: "E08000001", labels: ["Greater Manchester"] }],
		},
	],
};

const crosswalkLookup: CrosswalkLookup = new Map([
	[crosswalkArtifact.id, crosswalkArtifact],
	[containmentCrosswalk.id, containmentCrosswalk],
]);

const namedLocationInventory: NamedLocationInventory = {
	schemaVersion: 1,
	contentHash: "sha256:named-locations",
	source: {
		artifact: "data/precompiled/gazetteer.core.json",
		gazetteerVersion: 1,
	},
	locations: [
		{
			id: "greater-manchester",
			label: "Greater Manchester",
			kind: "editorial-grouping",
			memberCodes: ["E08000001", "E08000999"],
			bbox: [-2.5, 53.3, -2, 53.7],
		},
	],
};

const namedLocationLookup = createNamedLocationLookup(namedLocationInventory);

const routeWithNamedLocations = (url: string) =>
	route(
		"GET",
		url,
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		namedLocationInventory,
		namedLocationLookup,
	);

test("lists published geographies", () => {
	const response = route("GET", "/v1/geographies", registry);
	assert.equal(response.status, 200);
	assert.deepEqual(response.body, {
		apiVersion: "v1",
		atlasRelease: "sha256:registry",
		data: [
			{ id: "ward", latestRelease: "2025-01-en-ward", releaseCount: 1 },
		],
		meta: { nextCursor: null },
	});
});

test("gets one boundary release", () => {
	const response = route(
		"GET",
		"/v1/boundary-releases/ward/2025-01-en-ward",
		registry,
	);
	assert.equal(response.status, 200);
	assert.equal(
		"data" in response.body && response.body.data,
		registry.releases[0],
	);
});

test("publishes the geography compiler coverage", () => {
	const response = route(
		"GET",
		"/v1/geography-inventory",
		registry,
		geographyInventory,
	);
	assert.equal(response.status, 200);
	assert.equal(
		"data" in response.body && response.body.data,
		geographyInventory,
	);
});

test("gets a compiled area by its full identity", () => {
	const response = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05000001",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 200);
	assert.deepEqual("data" in response.body && response.body.data, {
		id: "ward/2025-01-en-ward/E05000001",
		geography: "ward",
		boundaryRelease: "2025-01-en-ward",
		code: "E05000001",
		name: "Example ward",
		aliases: ["Enghraifft ward"],
	});
});

test("gets an area's geometry as a GeoJSON Feature", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(
			root,
			"data",
			"boundaries",
			"ward",
			"2025-01-en-ward",
		);
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { WD25CD: "E05000001" },
						geometry: {
							type: "Point",
							coordinates: [-2.24, 53.48],
						},
					},
				],
			}),
		);
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2025-01-en-ward",
				{
					input: "boundaries/ward/2025-01-en-ward/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "WD25CD",
				},
			],
		]);
		const areaGeometryCache = new AreaGeometryCache(root, sources);

		const response = route(
			"GET",
			"/v1/areas/ward/2025-01-en-ward/E05000001/geometry",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			areaGeometryCache,
		);
		assert.equal(response.status, 200);
		assert.deepEqual("data" in response.body && response.body.data, {
			type: "Feature",
			id: "ward/2025-01-en-ward/E05000001",
			properties: {
				id: "ward/2025-01-en-ward/E05000001",
				geography: "ward",
				boundaryRelease: "2025-01-en-ward",
				code: "E05000001",
				name: "Example ward",
				aliases: ["Enghraifft ward"],
				geometrySource: { sourceCrs: "EPSG:4326" },
			},
			geometry: { type: "Point", coordinates: [-2.24, 53.48] },
		});

		const unknownArea = route(
			"GET",
			"/v1/areas/ward/2025-01-en-ward/E05099999/geometry",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			areaGeometryCache,
		);
		assert.equal(unknownArea.status, 404);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("finds every area containing a point and labels shared borders", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(
			root,
			"data",
			"boundaries",
			"ward",
			"2025-01-en-ward",
		);
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { WD25CD: "E05000001" },
						geometry: {
							type: "Polygon",
							coordinates: [
								[
									[0, 0],
									[3, 0],
									[3, 3],
									[0, 3],
									[0, 0],
								],
								[
									[1, 1],
									[2, 1],
									[2, 2],
									[1, 2],
									[1, 1],
								],
							],
						},
					},
					{
						properties: { WD25CD: "E05000002" },
						geometry: {
							type: "Polygon",
							coordinates: [
								[
									[3, 0],
									[4, 0],
									[4, 3],
									[3, 3],
									[3, 0],
								],
							],
						},
					},
				],
			}),
		);
		const areaGeometryCache = new AreaGeometryCache(
			root,
			new Map([
				[
					"ward/2025-01-en-ward",
					{
						input: "boundaries/ward/2025-01-en-ward/wards.geojson",
						crs: "EPSG:4326",
						codeProperty: "WD25CD",
					},
				],
			]),
		);

		const boundary = route(
			"GET",
			"/v1/areas:contains?lng=3&lat=0.5&geography=ward&release=2025-01-en-ward",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			areaGeometryCache,
		);
		assert.equal(boundary.status, 200);
		const data = "data" in boundary.body ? boundary.body.data : undefined;
		assert.deepEqual(data, {
			point: { lng: 3, lat: 0.5 },
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			boundaryRule: "included",
			matches: [
				{
					id: "ward/2025-01-en-ward/E05000001",
					code: "E05000001",
					name: "Example ward",
					aliases: ["Enghraifft ward"],
					containment: "boundary",
					geometrySource: { sourceCrs: "EPSG:4326" },
				},
				{
					id: "ward/2025-01-en-ward/E05000002",
					code: "E05000002",
					name: "Other ward",
					containment: "boundary",
					geometrySource: { sourceCrs: "EPSG:4326" },
				},
			],
		});

		const hole = route(
			"GET",
			"/v1/areas:contains?lng=1.5&lat=1.5&geography=ward&release=2025-01-en-ward",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			areaGeometryCache,
		);
		assert.equal(hole.status, 200);
		assert.deepEqual("data" in hole.body && hole.body.data, {
			point: { lng: 1.5, lat: 1.5 },
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			boundaryRule: "included",
			matches: [],
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("validates point lookup coordinates and reports unavailable geometry", () => {
	const invalid = route(
		"GET",
		"/v1/areas:contains?lng=181&lat=53&geography=ward&release=2025-01-en-ward",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(invalid.status, 400);

	const unavailable = route(
		"GET",
		"/v1/areas:contains?lng=-2&lat=53&geography=ward&release=2025-01-en-ward",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(unavailable.status, 503);
});

test("reports geometry as unavailable before the geometry cache is built", () => {
	const response = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05000001/geometry",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 503);
});

test("surfaces a missing or unsupported geometry source as a clear error", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const noSourceCache = new AreaGeometryCache(root, new Map());
		const noSource = route(
			"GET",
			"/v1/areas/ward/2025-01-en-ward/E05000001/geometry",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			noSourceCache,
		);
		assert.equal(noSource.status, 503);
		assert.equal(
			"title" in noSource.body && noSource.body.title,
			"Geometry Unavailable",
		);

		const nonWgs84Sources: GeometrySourceLookup = new Map([
			[
				"ward/2025-01-en-ward",
				{
					input: "boundaries/ward/2025-01-en-ward/wards.geojson",
					crs: "EPSG:3857",
					codeProperty: "WD25CD",
				},
			],
		]);
		const nonWgs84Cache = new AreaGeometryCache(root, nonWgs84Sources);
		const nonWgs84 = route(
			"GET",
			"/v1/areas/ward/2025-01-en-ward/E05000001/geometry",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			nonWgs84Cache,
		);
		assert.equal(nonWgs84.status, 503);
		assert.match(
			"detail" in nonWgs84.body ? nonWgs84.body.detail : "",
			/No transformation to WGS84 is available for geometry in EPSG:3857\./,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("searches and paginates compiled area identities", () => {
	const byCode = route(
		"GET",
		"/v1/areas?q=e05000001",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(byCode.status, 200);
	assert.deepEqual("data" in byCode.body && byCode.body.data, [
		{
			id: "ward/2025-01-en-ward/E05000001",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			code: "E05000001",
			name: "Example ward",
			aliases: ["Enghraifft ward"],
		},
	]);

	const byAlias = route(
		"GET",
		"/v1/areas?q=gm",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(byAlias.status, 200);
	assert.deepEqual("data" in byAlias.body && byAlias.body.data, [
		{
			id: "localAuthority/2025-01-uk-lad/E08000001",
			geography: "localAuthority",
			boundaryRelease: "2025-01-uk-lad",
			code: "E08000001",
			name: "Greater Manchester",
			aliases: ["GM"],
		},
	]);

	const first = route(
		"GET",
		"/v1/areas?geography=ward&limit=1",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(first.status, 200);
	assert.deepEqual("data" in first.body && first.body.data, [
		{
			id: "ward/2025-01-en-ward/E05000001",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			code: "E05000001",
			name: "Example ward",
			aliases: ["Enghraifft ward"],
		},
	]);
	const cursor = "meta" in first.body ? first.body.meta.nextCursor : null;
	assert.equal(typeof cursor, "string");
	assert.ok(cursor);

	const second = route(
		"GET",
		"/v1/areas?geography=ward&limit=1&cursor=" + cursor,
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(second.status, 200);
	assert.deepEqual("data" in second.body && second.body.data, [
		{
			id: "ward/2025-01-en-ward/E05000002",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			code: "E05000002",
			name: "Other ward",
		},
	]);
	assert.equal("meta" in second.body && second.body.meta.nextCursor, null);
});

test("navigates published relationships in both directions", () => {
	const ward = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05000001/relationships",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(ward.status, 200);
	assert.deepEqual("data" in ward.body && ward.body.data, {
		id: "ward/2025-01-en-ward/E05000001",
		geography: "ward",
		boundaryRelease: "2025-01-en-ward",
		code: "E05000001",
		name: "Example ward",
		aliases: ["Enghraifft ward"],
		relationships: [
			{
				relation: "within",
				counterpart: {
					id: "localAuthority/2025-01-uk-lad/E08000001",
					geography: "localAuthority",
					boundaryRelease: "2025-01-uk-lad",
					code: "E08000001",
					labels: ["Greater Manchester"],
				},
				crosswalk: {
					id: "ward-to-local-authority-2025",
					method: "clean-containment",
					quality: "publisher-supplied",
					weighting: { status: "not-applicable" },
				},
			},
		],
	});

	const localAuthority = route(
		"GET",
		"/v1/areas/localAuthority/2025-01-uk-lad/E08000001/relationships",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(localAuthority.status, 200);
	const data =
		"data" in localAuthority.body ? localAuthority.body.data : undefined;
	assert.ok(data && typeof data === "object" && "relationships" in data);
	assert.deepEqual((data as { relationships: unknown }).relationships, [
		{
			relation: "contains",
			counterpart: {
				id: "ward/2025-01-en-ward/E05000001",
				geography: "ward",
				boundaryRelease: "2025-01-en-ward",
				code: "E05000001",
				labels: ["Example ward"],
			},
			crosswalk: {
				id: "ward-to-local-authority-2025",
				method: "clean-containment",
				quality: "publisher-supplied",
				weighting: { status: "not-applicable" },
			},
		},
	]);
});

test("offers focused parent and child containment routes", () => {
	const parents = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05000001/parents",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(parents.status, 200);
	const parentData = "data" in parents.body ? parents.body.data : undefined;
	assert.ok(parentData && typeof parentData === "object");
	assert.equal(
		(parentData as { relationships: Array<{ relation: string }> })
			.relationships[0]?.relation,
		"within",
	);

	const children = route(
		"GET",
		"/v1/areas/localAuthority/2025-01-uk-lad/E08000001/children",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(children.status, 200);
	const childData = "data" in children.body ? children.body.data : undefined;
	assert.ok(childData && typeof childData === "object");
	assert.equal(
		(childData as { relationships: Array<{ relation: string }> })
			.relationships[0]?.relation,
		"contains",
	);
});

test("reports same-code continuity without calling it an exact historical match", () => {
	const historyLookup = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:ward-2024",
			geography: "ward",
			boundaryRelease: "2024-01-en-ward",
			codeProperty: "WD24CD",
			nameProperty: "WD24NM",
			areas: [{ code: "E05000001", name: "Example ward" }],
		},
		{
			schemaVersion: 1,
			contentHash: "sha256:ward-2025",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			codeProperty: "WD25CD",
			nameProperty: "WD25NM",
			areas: [{ code: "E05000001", name: "Example ward" }],
		},
	]);
	const response = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05000001/history",
		registry,
		geographyInventory,
		historyLookup,
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.deepEqual((data as { sameCodeReleases: unknown }).sameCodeReleases, [
		{
			id: "ward/2024-01-en-ward/E05000001",
			geography: "ward",
			boundaryRelease: "2024-01-en-ward",
			code: "E05000001",
			name: "Example ward",
			status: "same-code-continuity",
		},
	]);
	assert.match(
		(data as { note: string }).note,
		/does not assert unchanged geometry/,
	);
});

test("translates codes only through a crosswalk valid for the requested purpose", () => {
	const response = route(
		"GET",
		"/v1/translations?sourceGeography=constituency&sourceRelease=2010&code=E14000001&targetGeography=constituency&targetRelease=2024-07-uk-bgc&purpose=identity",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.deepEqual((data as { matches: unknown }).matches, [
		{
			crosswalk: {
				id: "constituency-2010-to-2024",
				method: "official-lookup",
				quality: "publisher-supplied",
				weighting: { status: "not-provided" },
			},
			source: { code: "E14000001", labels: ["Old seat"] },
			targets: [{ code: "E14001001", labels: ["New seat A"] }],
		},
	]);

	const unsupported = route(
		"GET",
		"/v1/translations?sourceGeography=constituency&sourceRelease=2010&code=E14000001&targetGeography=constituency&targetRelease=2024-07-uk-bgc&purpose=membership",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(unsupported.status, 422);
});

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
		unresolvedMemberCodes: ["E08000999"],
	});
});

test("lists published crosswalks", () => {
	const response = route(
		"GET",
		"/v1/crosswalks",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body && response.body.data,
		crosswalkInventory.crosswalks,
	);
});

test("gets one crosswalk's metadata without its full record set", () => {
	const response = route(
		"GET",
		"/v1/crosswalks/constituency-2010-to-2024",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.ok(data && !("records" in (data as object)));
	assert.deepEqual(data, {
		schemaVersion: 1,
		contentHash: "sha256:crosswalk-artifact",
		id: "constituency-2010-to-2024",
		method: "official-lookup",
		quality: "publisher-supplied",
		weighting: { status: "not-provided" },
		from: { geography: "constituency", boundaryRelease: "2010" },
		to: { geography: "constituency", boundaryRelease: "2024-07-uk-bgc" },
		provenance: { input: "lookup.geojson", inputHash: "sha256:input" },
		validation: crosswalkArtifact.validation,
	});

	const missing = route(
		"GET",
		"/v1/crosswalks/unknown",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(missing.status, 404);
});

test("filters crosswalk records by source code", () => {
	const response = route(
		"GET",
		"/v1/crosswalks/constituency-2010-to-2024/records?source=E14000001",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body && response.body.data,
		crosswalkArtifact.records,
	);

	const unfiltered = route(
		"GET",
		"/v1/crosswalks/constituency-2010-to-2024/records",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.deepEqual(
		"data" in unfiltered.body && unfiltered.body.data,
		crosswalkArtifact.records,
	);

	const noMatch = route(
		"GET",
		"/v1/crosswalks/constituency-2010-to-2024/records?source=unknown",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.deepEqual("data" in noMatch.body && noMatch.body.data, []);
});

const atlasRelease: AtlasRelease = {
	schemaVersion: 1,
	releaseId: "sha256:atlas-release",
	artifacts: [
		{
			id: "boundary-registry",
			path: "boundary-releases.json",
			contentHash: "sha256:registry",
		},
	],
};

test("gets the atlas release manifest", () => {
	const response = route(
		"GET",
		"/v1/atlas-release",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
	);
	assert.equal(response.status, 200);
	assert.equal(
		"atlasRelease" in response.body && response.body.atlasRelease,
		atlasRelease.releaseId,
	);
	assert.deepEqual(
		"data" in response.body && response.body.data,
		atlasRelease,
	);
});

const relationshipCandidateInventory: RelationshipCandidateInventory = {
	schemaVersion: 1,
	contentHash: "sha256:relationship-candidates",
	candidates: [
		{
			id: "parish-2019-04-ew-bgc-to-local-authority-unavailable",
			input: "boundaries/parish/2019-04-ew-bgc/parishes.geojson",
			from: {
				geography: "parish",
				boundaryRelease: "2019-04-ew-bgc",
				codeProperty: "parncp19cd",
				nameProperty: "parncp19nm",
			},
			to: { codeProperty: "lad19cd", nameProperty: "lad19nm" },
			status: "not-available",
			validation: {
				endpoints: {
					from: {
						status: "verified",
						availableAreaCount: 11556,
						referencedCodeCount: 11556,
					},
					to: {
						status: "not-available",
						reason: "No compiled target release has lad19cd/lad19nm fields.",
					},
				},
				relationship: {
					sourceFeatureCount: 11556,
					sourceCodeCount: 11556,
					targetCodeCount: 339,
					multiTargetSourceCount: 0,
					missingValueFeatureCount: 0,
				},
				reasons: [
					"No compiled target release has lad19cd/lad19nm fields.",
				],
			},
		},
	],
};

test("lists discovered relationship candidates and their coverage gaps", () => {
	const response = route(
		"GET",
		"/v1/relationship-candidates",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
		undefined,
		undefined,
		undefined,
		relationshipCandidateInventory,
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body && response.body.data,
		relationshipCandidateInventory.candidates,
	);
});

test("reports relationship candidates as unavailable before they are built", () => {
	const response = route(
		"GET",
		"/v1/relationship-candidates",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 503);
});

test("paginates crosswalk records with opaque cursors", () => {
	const pagedCrosswalk: CrosswalkArtifact = {
		...crosswalkArtifact,
		id: "paged-crosswalk",
		records: [
			...crosswalkArtifact.records,
			{
				source: { code: "E14000002", labels: ["Other old seat"] },
				targets: [{ code: "E14001002", labels: ["Other new seat"] }],
			},
		],
	};
	const pagedLookup: CrosswalkLookup = new Map([
		[pagedCrosswalk.id, pagedCrosswalk],
	]);
	const first = route(
		"GET",
		"/v1/crosswalks/paged-crosswalk/records?limit=1",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		pagedLookup,
	);
	assert.equal(first.status, 200);
	assert.deepEqual("data" in first.body && first.body.data, [
		pagedCrosswalk.records[0],
	]);
	const cursor = "meta" in first.body ? first.body.meta.nextCursor : null;
	assert.equal(typeof cursor, "string");
	assert.ok(cursor);

	const second = route(
		"GET",
		`/v1/crosswalks/paged-crosswalk/records?limit=1&cursor=${cursor}`,
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		pagedLookup,
	);
	assert.equal(second.status, 200);
	assert.deepEqual("data" in second.body && second.body.data, [
		pagedCrosswalk.records[1],
	]);
	assert.equal("meta" in second.body && second.body.meta.nextCursor, null);

	const invalid = route(
		"GET",
		"/v1/crosswalks/paged-crosswalk/records?limit=0",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		pagedLookup,
	);
	assert.equal(invalid.status, 400);
});

test("uses the immutable release id in every successful envelope", () => {
	const response = route(
		"GET",
		"/v1/geographies",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
	);
	assert.equal(response.status, 200);
	assert.equal(
		"atlasRelease" in response.body && response.body.atlasRelease,
		atlasRelease.releaseId,
	);
});

test("reports the atlas release as unavailable before it is built", () => {
	const response = route("GET", "/v1/atlas-release", registry);
	assert.equal(response.status, 503);
});

test("uses problem details for missing resources and unsupported methods", () => {
	const missing = route(
		"GET",
		"/v1/boundary-releases/ward/unknown",
		registry,
	);
	assert.equal(missing.status, 404);
	assert.equal("title" in missing.body && missing.body.title, "Not Found");

	const write = route("POST", "/v1/geographies", registry);
	assert.equal(write.status, 405);
	assert.equal(
		"title" in write.body && write.body.title,
		"Method Not Allowed",
	);
});

const validationReport: ValidationReport = {
	schemaVersion: 1,
	contentHash: "sha256:validation",
	inputs: { boundaryRegistry: "sha256:registry" },
	summary: {
		resourceCount: 2,
		checkCount: 2,
		passedCount: 1,
		waivedCount: 1,
		coverage: {
			boundaryReleases: 1,
			areaIdentities: 1,
			servableGeometry: 0,
			withRelationships: 1,
			crosswalks: 1,
			weightedCrosswalks: 0,
		},
	},
	resources: [
		{
			id: "boundary-releases/ward/2025-01-en-ward",
			kind: "boundary-release",
			status: "waived",
			checks: [
				{
					id: "geometry-servable",
					status: "waived",
					detail: "Geometry is EPSG:3857, and no transformation to WGS84 is available.",
					waiver: { reason: "No transformation yet." },
				},
			],
		},
		{
			id: "crosswalks/constituency-2010-to-2024-official-lookup-v2",
			kind: "crosswalk",
			status: "passed",
			checks: [{ id: "artifact-integrity", status: "passed" }],
		},
	],
};

const validationRoute = (url: string, report?: ValidationReport) =>
	route(
		"GET",
		url,
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
		undefined,
		undefined,
		undefined,
		relationshipCandidateInventory,
		report,
	);

test("serves the validation report, optionally only resources with waivers", () => {
	const all = validationRoute("/v1/validation", validationReport);
	assert.equal(all.status, 200);
	assert.deepEqual("data" in all.body && all.body.data, validationReport);
	const waived = validationRoute(
		"/v1/validation?status=waived",
		validationReport,
	);
	assert.deepEqual(
		"data" in waived.body &&
			(waived.body.data as ValidationReport).resources.map(
				(resource) => resource.id,
			),
		["boundary-releases/ward/2025-01-en-ward"],
	);
	assert.equal(
		validationRoute("/v1/validation?status=failed", validationReport)
			.status,
		400,
	);
});

test("serves one resource's validation at the resource's own path", () => {
	const release = validationRoute(
		"/v1/validation/boundary-releases/ward/2025-01-en-ward",
		validationReport,
	);
	assert.equal(release.status, 200);
	assert.deepEqual(
		"data" in release.body && release.body.data,
		validationReport.resources[0],
	);
	const crosswalk = validationRoute(
		"/v1/validation/crosswalks/constituency-2010-to-2024-official-lookup-v2",
		validationReport,
	);
	assert.equal(crosswalk.status, 200);
	assert.equal(
		validationRoute("/v1/validation/crosswalks/unknown", validationReport)
			.status,
		404,
	);
	assert.equal(
		validationRoute("/v1/validation/areas/ward", validationReport).status,
		404,
	);
});

test("reports validation as unavailable before the report is built", () => {
	assert.equal(validationRoute("/v1/validation").status, 503);
	assert.equal(
		validationRoute("/v1/validation/crosswalks/unknown").status,
		503,
	);
});
