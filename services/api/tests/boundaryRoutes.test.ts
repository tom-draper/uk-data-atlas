import { createGeographyServices } from "@uk-data-atlas/atlas-runtime/areas";
import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "@uk-data-atlas/atlas-runtime/areas";
import type { CrosswalkArtifact } from "@uk-data-atlas/atlas-runtime/relationships";
import { createGeographyResolver } from "@uk-data-atlas/atlas-runtime/areas";
import { route as routeRequest, routeAsync } from "../src/routes";
import type { RouteContext } from "@uk-data-atlas/atlas-runtime/api";
import {
	route,
	registry,
	geographyInventory,
	testContext,
} from "./routeFixtures";

test("lists published boundaries", () => {
	const response = route("GET", "/v1/boundaries", registry);
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

test("sends the old geographies address to boundaries", () => {
	const response = route("GET", "/v1/geographies?limit=2", registry);
	assert.equal(response.status, 308);
	assert.equal(response.headers?.location, "/v1/boundaries?limit=2");
});

test("gets one boundary release", () => {
	const response = route(
		"GET",
		"/v1/boundary-releases/ward/2025-01-en-ward",
		registry,
	);
	assert.equal(response.status, 200);
	assert.deepEqual("data" in response.body && response.body.data, {
		...registry.releases[0],
		documents: {
			validation: "/v1/documents/validation-report.json",
			health: "/v1/documents/geography-health.json",
		},
		downloads: {
			status: "unavailable",
			reason: "No map resource has been compiled for this release.",
		},
	});
});

test("links a boundary release to its whole-release downloads", async () => {
	const href = "/v1/map-resources/ward/2025-01-en-ward";
	const withMap = (mapResources: RouteContext["mapResources"]) =>
		routeRequest("GET", "/v1/boundary-releases/ward/2025-01-en-ward", {
			...testContext({ boundaryRegistry: registry }),
			mapResources,
		}).body as { data: { downloads: unknown } };

	const feature = (tier: string, format: string) => ({
		tier,
		format,
		href: `${href}/features?tier=${tier}${format === "geojson" ? "&format=geojson" : ""}`,
	});
	assert.deepEqual(
		withMap({
			resources: [
				{
					id: "ward/2025-01-en-ward",
					geography: "ward",
					boundaryRelease: "2025-01-en-ward",
					tiles: { href: `${href}.pmtiles` },
					features: [
						feature("full", "geoparquet-1.1"),
						feature("low", "geoparquet-1.1"),
						feature("low", "geojson"),
					],
				} as never,
			],
		}).data.downloads,
		{
			status: "available",
			mapResource: href,
			pmtiles: `${href}.pmtiles`,
			tileJson: `${href}/tiles.json`,
			geojson: {
				low: `${href}/features?tier=low&format=geojson`,
			},
			geoparquet: {
				full: `${href}/features?tier=full`,
				low: `${href}/features?tier=low`,
			},
		},
	);
	// A release the build could not tile says why, rather than only that it
	// is missing.
	assert.deepEqual(
		withMap({
			resources: [],
			unavailable: [
				{
					geography: "ward",
					boundaryRelease: "2025-01-en-ward",
					reason: "ward/2025-01-en-ward is not a coverage.",
				},
			],
		}).data.downloads,
		{
			status: "unavailable",
			reason: "ward/2025-01-en-ward is not a coverage.",
		},
	);
	// One that could not be tiled but whose areas could be read is still
	// downloadable whole, as GeoParquet at full detail.
	assert.deepEqual(
		withMap({
			resources: [],
			unavailable: [
				{
					geography: "ward",
					boundaryRelease: "2025-01-en-ward",
					reason: "ward/2025-01-en-ward is not a coverage.",
					features: [feature("full", "geoparquet-1.1")] as never,
				},
			],
		}).data.downloads,
		{
			status: "untiled",
			reason: "No tiles: ward/2025-01-en-ward is not a coverage. The release is still downloadable whole as GeoParquet, at full detail as published.",
			geoparquet: { full: `${href}/features?tier=full` },
		},
	);
	const built = Buffer.from("PAR1 built from the store PAR1");
	const builds: unknown[][] = [];
	const untiled: RouteContext = {
		...testContext({ boundaryRegistry: registry }),
		mapResources: {
			resources: [],
			unavailable: [
				{
					geography: "ward",
					boundaryRelease: "2025-01-en-ward",
					reason: "ward/2025-01-en-ward is not a coverage.",
					features: [
						{
							...feature("full", "geoparquet-1.1"),
							bytes: built.length,
							contentHash: "sha256:00",
						},
					] as never,
				},
			],
		},
		fullDetailDownloads: {
			get: (...asked) => {
				assert.equal(asked.length, 4);
				builds.push(asked.map(String));
				return { status: "built", body: built };
			},
		},
	};
	// Built from the store, untiled releases having no shared borders.
	const download = routeRequest("GET", `${href}/features?tier=full`, untiled);
	assert.equal(download.status, 200);
	assert.equal(
		download.representation?.contentType,
		"application/vnd.apache.parquet",
	);
	assert.equal(download.representation?.body, built);
	assert.equal(download.representation?.contentHash, "sha256:00");
	assert.deepEqual(builds, [
		["ward", "2025-01-en-ward", "none", "sha256:00"],
	]);
	// A server awaits the build rather than building while others wait.
	builds.length = 0;
	const awaited = await routeAsync("GET", `${href}/features?tier=full`, {
		...untiled,
		fullDetailDownloads: {
			get: () => assert.fail("built on the request's own turn"),
			build: async (...asked) => {
				assert.equal(asked.length, 4);
				builds.push(asked.map(String));
				return { status: "built", body: built };
			},
		},
	});
	assert.equal(awaited.status, 200);
	assert.equal(awaited.representation?.body, built);
	assert.deepEqual(builds, [
		["ward", "2025-01-en-ward", "none", "sha256:00"],
	]);
	const asGeoJson = routeRequest(
		"GET",
		`${href}/features?tier=full&format=geojson`,
		untiled,
	);
	assert.equal(asGeoJson.status, 404);
	assert.match(
		(asGeoJson.body as { detail: string }).detail,
		/GeoParquet only/,
	);
	const coarser = routeRequest("GET", `${href}/features?tier=low`, untiled);
	assert.equal(coarser.status, 404);
	assert.match(
		(coarser.body as { detail: string }).detail,
		/downloadable at full only/,
	);
	// Tiles are not offered for it.
	assert.equal(
		routeRequest("GET", `${href}/tiles.json`, untiled).status,
		404,
	);
});

test("does not expose geography compiler coverage as a query route", () => {
	const response = route(
		"GET",
		"/v1/geography-inventory",
		registry,
		geographyInventory,
	);
	assert.equal(response.status, 404);
});

test("resolves the boundary release to use for a date", () => {
	const context: RouteContext = {
		boundaryRegistry: {
			...registry,
			releases: [
				...registry.releases,
				{ ...registry.releases[0]!, id: "2023-05-en-ward" },
			],
		},
		areaValidation: createGeographyServices({}).validation,
		postcodes: createGeographyServices({}).postcodes,
		geographyResolver: createGeographyResolver({
			boundaryRegistry: {
				...registry,
				releases: [
					...registry.releases,
					{ ...registry.releases[0]!, id: "2023-05-en-ward" },
				],
			},
		}),
	};
	const resolve = (query: string) =>
		routeRequest("GET", `/v1/boundary-releases:resolve?${query}`, context);

	const inMonth = resolve("geography=ward&date=2025-01");
	assert.equal(inMonth.status, 200);
	const data = (inMonth.body as { data: Record<string, unknown> }).data;
	assert.equal((data.selected as { id: string }).id, "2025-01-en-ward");
	assert.equal(data.sameMonth, true);
	assert.equal((data.previous as { id: string }).id, "2023-05-en-ward");
	assert.equal(data.next, null);
	assert.equal(data.basis, "latest-release-dated-on-or-before");

	const between = resolve("geography=ward&date=2024-02-29");
	assert.equal(
		(between.body as { data: { selected: { id: string } } }).data.selected
			.id,
		"2023-05-en-ward",
	);

	assert.equal(resolve("geography=ward&date=2023-02-29").status, 400);
	assert.equal(resolve("date=2024-01-01").status, 400);
	assert.equal(resolve("geography=ward&date=2024-01&country=GB").status, 400);

	const early = resolve("geography=ward&date=2020-01-01");
	assert.equal(early.status, 404);
	assert.deepEqual(
		"code" in early.body && [early.body.code, early.body.absence],
		["no_release_for_date", "before-first-release"],
	);
	const unknownGeography = resolve("geography=parish&date=2024-01");
	assert.equal(
		"code" in unknownGeography.body && unknownGeography.body.code,
		"unsupported_geography",
	);
});

test("compares release code sets without claiming that differences are geography changes", () => {
	const boundaryRegistry = {
		...registry,
		releases: [
			{ ...registry.releases[0]!, id: "2024-05-en-ward" },
			{ ...registry.releases[0]!, id: "2025-05-en-ward" },
		],
	};
	const areaLookup = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:wards-2024",
			geography: "ward",
			boundaryRelease: "2024-05-en-ward",
			codeProperty: "WD24CD",
			nameProperty: "WD24NM",
			areas: [
				{ code: "E05000001", name: "Shared ward" },
				{ code: "E05000002", name: "Earlier ward" },
			],
		},
		{
			schemaVersion: 1,
			contentHash: "sha256:wards-2025",
			geography: "ward",
			boundaryRelease: "2025-05-en-ward",
			codeProperty: "WD25CD",
			nameProperty: "WD25NM",
			areas: [
				{ code: "E05000001", name: "Shared ward" },
				{ code: "E05000003", name: "Later ward" },
			],
		},
	]);
	const context: RouteContext = {
		boundaryRegistry,
		areaValidation: createGeographyServices({}).validation,
		postcodes: createGeographyServices({}).postcodes,
		geographyResolver: createGeographyResolver({
			boundaryRegistry,
			areaLookup,
		}),
	};
	const response = routeRequest(
		"GET",
		"/v1/boundary-releases:compare?geography=ward&from=2024-05-en-ward&to=2025-05-en-ward",
		context,
	);
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.deepEqual(data.summary, {
		fromAreaCount: 2,
		toAreaCount: 2,
		sharedCodeCount: 1,
		codesOnlyInFromCount: 1,
		codesOnlyInToCount: 1,
		continuousCodeCount: 0,
		recodedCodeCount: 0,
		changedExtentCount: 0,
		indeterminateExtentCount: 0,
		unmeasuredCodeCount: 0,
		unassessedSharedCodeCount: 1,
		publishedRelationshipCount: 0,
	});
	assert.deepEqual(data.codes, {
		onlyInFrom: [
			{
				id: "ward/2024-05-en-ward/E05000002",
				code: "E05000002",
				name: "Earlier ward",
			},
		],
		onlyInTo: [
			{
				id: "ward/2025-05-en-ward/E05000003",
				code: "E05000003",
				name: "Later ward",
			},
		],
	});
	assert.deepEqual(data.continuity, {
		status: "not-published",
		reason: "No extent continuity crosswalk has compared these releases' shared identifiers.",
	});
	assert.equal(
		routeRequest(
			"GET",
			"/v1/boundary-releases:compare?geography=ward&from=2024-05-en-ward&to=2024-05-en-ward",
			context,
		).status,
		400,
	);
});

test("summarises published release mappings as directional cardinality evidence", () => {
	const boundaryRegistry = {
		...registry,
		releases: [
			{ ...registry.releases[0]!, id: "2024-05-en-ward" },
			{ ...registry.releases[0]!, id: "2025-05-en-ward" },
		],
	};
	const areaLookup = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:wards-2024",
			geography: "ward",
			boundaryRelease: "2024-05-en-ward",
			codeProperty: "WD24CD",
			nameProperty: "WD24NM",
			areas: [
				{ code: "A", name: "Earlier A" },
				{ code: "B", name: "Earlier B" },
				{ code: "C", name: "Earlier C" },
			],
		},
		{
			schemaVersion: 1,
			contentHash: "sha256:wards-2025",
			geography: "ward",
			boundaryRelease: "2025-05-en-ward",
			codeProperty: "WD25CD",
			nameProperty: "WD25NM",
			areas: [
				{ code: "X", name: "Later X" },
				{ code: "Y", name: "Later Y" },
				{ code: "Z", name: "Later Z" },
			],
		},
	]);
	const lookup: CrosswalkArtifact = {
		schemaVersion: 1,
		contentHash: "sha256:published-ward-change",
		id: "published-ward-change",
		method: "official-lookup",
		quality: "publisher-supplied",
		relationshipPurpose: "identity",
		weighting: { status: "not-applicable" },
		from: { geography: "ward", boundaryRelease: "2024-05-en-ward" },
		to: { geography: "ward", boundaryRelease: "2025-05-en-ward" },
		provenance: {
			input: "published-lookup.csv",
			inputHash: "sha256:lookup",
		},
		validation: {
			sourceNameConflicts: [],
			endpoints: {
				from: {
					status: "verified",
					availableAreaCount: 3,
					referencedCodeCount: 3,
				},
				to: {
					status: "verified",
					availableAreaCount: 3,
					referencedCodeCount: 3,
				},
			},
		},
		records: [
			{
				source: { code: "A", labels: ["Earlier A"] },
				targets: [
					{ code: "X", labels: ["Later X"] },
					{ code: "Y", labels: ["Later Y"] },
				],
			},
			{
				source: { code: "B", labels: ["Earlier B"] },
				targets: [{ code: "Y", labels: ["Later Y"] }],
			},
			{
				source: { code: "C", labels: ["Earlier C"] },
				targets: [{ code: "Z", labels: ["Later Z"] }],
			},
		],
	};
	const context: RouteContext = {
		boundaryRegistry,
		areaValidation: createGeographyServices({}).validation,
		postcodes: createGeographyServices({}).postcodes,
		geographyResolver: createGeographyResolver({
			boundaryRegistry,
			areaLookup,
			crosswalkLookup: new Map([[lookup.id, lookup]]),
		}),
	};
	const response = routeRequest(
		"GET",
		"/v1/boundary-releases:compare?geography=ward&from=2024-05-en-ward&to=2025-05-en-ward",
		context,
	);
	assert.equal(response.status, 200);
	const relationship = (response.body as { data: any }).data
		.publishedRelationships[0];
	assert.deepEqual(relationship.mapping, {
		shape: "many-to-many",
		fromCodeCount: 3,
		toCodeCount: 3,
		pairCount: 4,
		from: { noTargetCount: 0, oneTargetCount: 2, multipleTargetCount: 1 },
		to: { oneSourceCount: 2, multipleSourceCount: 1 },
		examples: {
			oneToMany: [{ fromCode: "A", toCodes: ["X", "Y"] }],
			manyToOne: [{ toCode: "Y", fromCodes: ["A", "B"] }],
		},
		note: "Cardinality describes codes in this crosswalk's published records, viewed from the requested release to the other release. It does not establish a legal boundary change or account for release codes absent from the records.",
	});
	assert.equal(relationship.direction, "forward");

	const reverse = routeRequest(
		"GET",
		"/v1/boundary-releases:compare?geography=ward&from=2025-05-en-ward&to=2024-05-en-ward",
		context,
	);
	assert.equal(reverse.status, 200);
	const reverseRelationship = (reverse.body as { data: any }).data
		.publishedRelationships[0];
	assert.equal(reverseRelationship.direction, "reverse");
	assert.deepEqual(reverseRelationship.mapping.examples, {
		oneToMany: [{ fromCode: "Y", toCodes: ["A", "B"] }],
		manyToOne: [{ toCode: "A", fromCodes: ["X", "Y"] }],
	});
});

test("reports published extent continuity findings separately from code-set evidence", () => {
	const boundaryRegistry = {
		...registry,
		releases: [
			{ ...registry.releases[0]!, id: "2024-05-en-ward" },
			{ ...registry.releases[0]!, id: "2025-05-en-ward" },
		],
	};
	const areaLookup = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:wards-2024",
			geography: "ward",
			boundaryRelease: "2024-05-en-ward",
			codeProperty: "WD24CD",
			nameProperty: "WD24NM",
			areas: [
				{ code: "E05000001", name: "Continuous ward" },
				{ code: "E05000002", name: "Changed ward" },
				{ code: "E05000003", name: "Renumbered ward" },
			],
		},
		{
			schemaVersion: 1,
			contentHash: "sha256:wards-2025",
			geography: "ward",
			boundaryRelease: "2025-05-en-ward",
			codeProperty: "WD25CD",
			nameProperty: "WD25NM",
			areas: [
				{ code: "E05000001", name: "Continuous ward" },
				{ code: "E05000002", name: "Changed ward" },
				{ code: "E05000009", name: "Renumbered ward" },
			],
		},
	]);
	const continuity: CrosswalkArtifact = {
		schemaVersion: 1,
		contentHash: "sha256:continuity",
		id: "ward-continuity",
		method: "extent-continuity",
		quality: "derived",
		relationshipPurpose: "identity",
		weighting: { status: "not-applicable" },
		from: { geography: "ward", boundaryRelease: "2024-05-en-ward" },
		to: { geography: "ward", boundaryRelease: "2025-05-en-ward" },
		provenance: {
			inputs: [
				{
					side: "from",
					input: "wards-2024.geojson",
					inputHash: "sha256:2024",
					sourceCrs: "EPSG:27700",
				},
				{
					side: "to",
					input: "wards-2025.geojson",
					inputHash: "sha256:2025",
					sourceCrs: "EPSG:27700",
				},
			],
			areaProjection: "EPSG:6933",
			clipping: "fixture",
		},
		validation: {
			sourceNameConflicts: [],
			endpoints: {
				from: {
					status: "verified",
					availableAreaCount: 3,
					referencedCodeCount: 2,
				},
				to: {
					status: "verified",
					availableAreaCount: 3,
					referencedCodeCount: 2,
				},
			},
			continuity: {
				sliverWidthM: 100,
				differenceRule: "claimed-by-another-area",
				sourceAreaCount: 3,
				targetAreaCount: 3,
				sharedCodeCount: 2,
				continuousCount: 1,
				changedExtent: [
					{
						code: "E05000002",
						relation: "changed",
						widestDifferenceM: 250,
						claimedDifferenceM: 250,
						sourceShare: 0.8,
						targetShare: 0.75,
					},
				],
				realignedShare: 0.9,
				realigned: [],
				unmeasured: [],
				recoded: {
					status: "compared",
					widthCeilingM: 6.5,
					noiseSampleCount: 1,
					retiredCodeCount: 1,
					introducedCodeCount: 1,
					matchedCount: 1,
					ambiguous: [],
					nearMisses: [],
					unmeasured: [],
				},
			},
		},
		records: [
			{
				source: { code: "E05000001", labels: ["Continuous ward"] },
				targets: [
					{
						code: "E05000001",
						labels: ["Continuous ward"],
						match: "same-code",
						widestDifferenceM: 2,
						sourceShare: 1,
						targetShare: 1,
					},
				],
			},
			{
				source: { code: "E05000003", labels: ["Renumbered ward"] },
				targets: [
					{
						code: "E05000009",
						labels: ["Renumbered ward"],
						match: "recoded",
						widestDifferenceM: 0,
						sourceShare: 1,
						targetShare: 1,
					},
				],
			},
		],
	};
	const context: RouteContext = {
		boundaryRegistry,
		areaValidation: createGeographyServices({}).validation,
		postcodes: createGeographyServices({}).postcodes,
		geographyResolver: createGeographyResolver({
			boundaryRegistry,
			areaLookup,
			crosswalkLookup: new Map([[continuity.id, continuity]]),
		}),
	};
	const response = routeRequest(
		"GET",
		"/v1/boundary-releases:compare?geography=ward&from=2024-05-en-ward&to=2025-05-en-ward",
		context,
	);
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.equal(data.summary.continuousCodeCount, 1);
	assert.equal(data.summary.recodedCodeCount, 1);
	assert.equal(data.summary.changedExtentCount, 1);
	assert.equal(data.summary.unassessedSharedCodeCount, 0);
	assert.deepEqual(data.continuity, {
		status: "available",
		crosswalks: ["ward-continuity"],
		recoded: [
			{
				fromCode: "E05000003",
				toCode: "E05000009",
				widestDifferenceM: 0,
			},
		],
		changedExtent: [
			{
				code: "E05000002",
				relation: "changed",
				widestDifferenceM: 250,
				fromShare: 0.8,
				toShare: 0.75,
			},
		],
		unmeasured: [],
		unassessedSharedCodes: [],
	});
});

test("awaits simplified downloads at their API URL even with CDN tiles", async () => {
	const body = Buffer.from('{"type":"FeatureCollection","features":[]}');
	let builds = 0;
	const context = testContext({
		mapResources: {
			assetBaseUrl: "https://maps.example.com",
			resources: [
				{
					id: "ward/test",
					geography: "ward",
					boundaryRelease: "test",
					tiles: {},
					features: [
						{
							tier: "low",
							format: "geojson",
							contentHash: "hash",
							bytes: body.length,
							href: "/v1/map-resources/ward/test/features?tier=low&format=geojson",
						},
					],
				} as never,
			],
		},
		fullDetailDownloads: {
			get: () => assert.fail("Should await the download"),
			build: async (...asked) => {
				builds++;
				assert.deepEqual(asked, [
					"ward",
					"test",
					"shared-arc",
					"hash",
					{ tier: "low", format: "geojson" },
				]);
				return { status: "built", body };
			},
		},
	});
	const result = await routeAsync(
		"GET",
		"/v1/map-resources/ward/test/features?tier=low&format=geojson",
		context,
	);
	assert.equal(result.status, 200);
	assert.equal(result.representation?.body, body);
	assert.equal(result.representation?.contentType, "application/geo+json");
	assert.equal(builds, 1);
	const invalid = await routeAsync(
		"GET",
		"/v1/map-resources/ward/test/features?tier=full&format=geojson",
		context,
	);
	assert.equal(invalid.status, 404);
	assert.equal(builds, 1);
});
