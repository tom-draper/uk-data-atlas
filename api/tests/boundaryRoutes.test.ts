import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import type { CrosswalkArtifact } from "../src/crosswalkInventory";
import { createGeographyResolver } from "../src/geographyResolver";
import { route as routeRequest } from "../src/routes";
import type { RouteContext } from "../src/routing";
import { route, registry, geographyInventory } from "./routeFixtures";

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

test("resolves the boundary release to use for a date", () => {
	const context: RouteContext = {
		boundaryRegistry: {
			...registry,
			releases: [
				...registry.releases,
				{ ...registry.releases[0]!, id: "2023-05-en-ward" },
			],
		},
	};
	context.geographyResolver = createGeographyResolver({
		boundaryRegistry: context.boundaryRegistry,
	});
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
		areaLookup,
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
		reason:
			"No same-code continuity crosswalk has compared these releases' shared identifiers.",
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

test("reports published same-code continuity findings separately from code-set evidence", () => {
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
			],
		},
	]);
	const continuity: CrosswalkArtifact = {
		schemaVersion: 1,
		contentHash: "sha256:continuity",
		id: "ward-continuity",
		method: "same-code-continuity",
		quality: "derived",
		relationshipPurpose: "identity",
		weighting: { status: "not-applicable" },
		from: { geography: "ward", boundaryRelease: "2024-05-en-ward" },
		to: { geography: "ward", boundaryRelease: "2025-05-en-ward" },
		provenance: {
			inputs: [
				{ side: "from", input: "wards-2024.geojson", inputHash: "sha256:2024" },
				{ side: "to", input: "wards-2025.geojson", inputHash: "sha256:2025" },
			],
			areaProjection: "EPSG:6933",
			clipping: "fixture",
		},
		validation: {
			sourceNameConflicts: [],
			endpoints: {
				from: { status: "verified", availableAreaCount: 2, referencedCodeCount: 1 },
				to: { status: "verified", availableAreaCount: 2, referencedCodeCount: 1 },
			},
			continuity: {
				sliverWidthM: 100,
				sourceAreaCount: 2,
				targetAreaCount: 2,
				sharedCodeCount: 2,
				continuousCount: 1,
				changedExtent: [
					{
						code: "E05000002",
						relation: "changed",
						widestDifferenceM: 250,
						sourceShare: 0.8,
						targetShare: 0.75,
					},
				],
				unmeasured: [],
			},
		},
		records: [
			{
				source: { code: "E05000001", labels: ["Continuous ward"] },
				targets: [
					{
						code: "E05000001",
						labels: ["Continuous ward"],
						widestDifferenceM: 2,
						sourceShare: 1,
						targetShare: 1,
					},
				],
			},
		],
	};
	const context: RouteContext = {
		boundaryRegistry,
		areaLookup,
		crosswalkLookup: new Map([[continuity.id, continuity]]),
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
	assert.equal(data.summary.changedExtentCount, 1);
	assert.equal(data.summary.unassessedSharedCodeCount, 0);
	assert.deepEqual(data.continuity, {
		status: "available",
		crosswalks: ["ward-continuity"],
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
