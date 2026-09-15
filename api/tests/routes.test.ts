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
import { route as routeRequest } from "../src/routes";
import type { CrosswalkLookup, RouteContext } from "../src/routing";
import type { AtlasRelease } from "../src/atlasRelease";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "../src/crosswalkInventory";
import type { ValidationReport } from "../src/validationReport";
import {
	route,
	registry,
	testContext,
	geographyInventory,
	areaLookup,
	compatibleWardAreaLookup,
	namedLocationAreaLookup,
	crosswalkArtifact,
	crosswalkInventory,
	containmentCrosswalk,
	crosswalkLookup,
	namedLocationInventory,
	namedLocationLookup,
	dataCatalog,
	measureObservations,
	populationObservations,
	populationLocalAuthorityObservations,
	measureCompatibilityInventory,
	routeWithCatalog,
	atlasRelease,
	relationshipCandidateInventory,
	validationReport,
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
				// Full resolution by default, and no method block with it:
				// nothing was done to the geometry to explain.
				generalisation: {
					tier: "full",
					toleranceM: 0,
					minEffectiveAreaM2: 0,
					vertices: 1,
					verticesAtFullResolution: 1,
					parts: 0,
					partsAtFullResolution: 0,
				},
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
				provenance: {
					input: "lookup.geojson",
					inputHash: "sha256:input",
				},
				direction: "forward",
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

test("reverses published identity and containment crosswalks", () => {
	const identity = route(
		"GET",
		"/v1/translations?sourceGeography=constituency&sourceRelease=2024-07-uk-bgc&code=E14001001&targetGeography=constituency&targetRelease=2010&purpose=identity",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(identity.status, 200);
	assert.deepEqual(
		"data" in identity.body &&
			(identity.body.data as { matches: unknown }).matches,
		[
			{
				crosswalk: {
					id: "constituency-2010-to-2024",
					method: "official-lookup",
					quality: "publisher-supplied",
					weighting: { status: "not-provided" },
					provenance: {
						input: "lookup.geojson",
						inputHash: "sha256:input",
					},
					direction: "reverse",
				},
				source: { code: "E14001001", labels: ["New seat A"] },
				targets: [{ code: "E14000001", labels: ["Old seat"] }],
			},
		],
	);

	const membership = route(
		"GET",
		"/v1/translations?sourceGeography=localAuthority&sourceRelease=2025-01-uk-lad&code=E08000001&targetGeography=ward&targetRelease=2025-01-en-ward&purpose=membership",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(membership.status, 200);
	assert.deepEqual(
		"data" in membership.body &&
			(membership.body.data as { matches: unknown }).matches,
		[
			{
				crosswalk: {
					id: "ward-to-local-authority-2025",
					method: "clean-containment",
					quality: "publisher-supplied",
					weighting: { status: "not-applicable" },
					provenance: {
						input: "lookup.geojson",
						inputHash: "sha256:input",
					},
					direction: "reverse",
				},
				source: { code: "E08000001", labels: ["Greater Manchester"] },
				targets: [{ code: "E05000001", labels: ["Example ward"] }],
			},
		],
	);
});

test("normalises reverse area-overlap weights against the queried target", () => {
	const overlap: CrosswalkArtifact = {
		schemaVersion: 1,
		contentHash: "sha256:overlap",
		id: "constituency-to-local-authority-overlap",
		method: "area-overlap",
		quality: "derived",
		weighting: {
			status: "provided",
			basis: "area",
			normalisation: "per-source",
		},
		from: { geography: "constituency", boundaryRelease: "2024" },
		to: { geography: "localAuthority", boundaryRelease: "2025" },
		provenance: {
			inputs: [],
			areaProjection: "EPSG:6933",
			clipping: "none",
		},
		validation: {
			sourceNameConflicts: [],
			endpoints: {
				from: { status: "not-available", reason: "Fixture." },
				to: { status: "not-available", reason: "Fixture." },
			},
			overlap: {
				candidatePairCount: 2,
				intersectingPairCount: 2,
				sliverPairCount: 0,
				sliverWidthM: 100,
				widestSliverWidthM: null,
				narrowestOverlapWidthM: 200,
				minimumCoverage: 0.99,
				minimumSourceCoverage: 1,
				minimumTargetCoverage: 1,
			},
		},
		records: [
			{
				source: {
					code: "E14000001",
					labels: ["First seat"],
					areaM2: 400,
					coverage: 1,
				},
				targets: [
					{
						code: "E08000001",
						labels: ["Example authority"],
						weight: 1,
						overlapAreaM2: 400,
						sourceShare: 1,
						targetShare: 0.4,
					},
				],
			},
			{
				source: {
					code: "E14000002",
					labels: ["Second seat"],
					areaM2: 600,
					coverage: 1,
				},
				targets: [
					{
						code: "E08000001",
						labels: ["Example authority"],
						weight: 1,
						overlapAreaM2: 600,
						sourceShare: 1,
						targetShare: 0.6,
					},
				],
			},
		],
	};
	const response = route(
		"GET",
		"/v1/translations?sourceGeography=localAuthority&sourceRelease=2025&code=E08000001&targetGeography=constituency&targetRelease=2024&purpose=apportion",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		new Map([...crosswalkLookup, [overlap.id, overlap]]),
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.deepEqual(
		(data as { matches: Array<{ sourceCoverage: number }> }).matches[0]
			.sourceCoverage,
		1,
	);
	assert.deepEqual(
		(data as { matches: Array<{ targets: unknown }> }).matches[0].targets,
		[
			{
				code: "E14000001",
				labels: ["First seat"],
				areaM2: 400,
				coverage: 1,
				weight: 0.4,
				overlapAreaM2: 400,
				sourceShare: 0.4,
				targetShare: 1,
			},
			{
				code: "E14000002",
				labels: ["Second seat"],
				areaM2: 600,
				coverage: 1,
				weight: 0.6,
				overlapAreaM2: 600,
				sourceShare: 0.6,
				targetShare: 1,
			},
		],
	);
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

test("lists and compares archived Atlas releases by immutable artifact hash", () => {
	const previous: AtlasRelease = {
		schemaVersion: 1,
		releaseId: "sha256:previous-release",
		artifacts: [
			{
				id: "boundary-registry",
				path: "boundary-releases.json",
				contentHash: "sha256:previous-registry",
			},
		],
	};
	const context = {
		boundaryRegistry: registry,
		atlasRelease,
		atlasReleaseHistory: new Map([
			[previous.releaseId, previous],
			[atlasRelease.releaseId, atlasRelease],
		]),
	};
	const releases = routeRequest("GET", "/v1/atlas-releases", context);
	assert.equal(releases.status, 200);
	assert.equal(
		(("data" in releases.body ? releases.body.data : []) as unknown[])
			.length,
		2,
	);
	const comparison = routeRequest(
		"GET",
		`/v1/atlas-releases/compare?from=${previous.releaseId}`,
		context,
	);
	assert.equal(comparison.status, 200);
	assert.deepEqual(
		"data" in comparison.body &&
			(comparison.body.data as { summary: unknown }).summary,
		{ added: 0, removed: 0, changed: 1, unchanged: 0 },
	);
});

test("lists and downloads release-pinned whole observation artifacts", () => {
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === "small-area-fixture",
	);
	const source = measure?.sources[0];
	assert.ok(measure && source);
	const manifest = {
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
				contentHash: "sha256:small-area-observations",
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
			},
		],
	};
	const listed = routeWithCatalog(
		"/v1/exports",
		dataCatalog,
		measureObservations,
		{ exportManifest: manifest },
	);
	assert.equal(listed.status, 200);
	const listedData =
		"data" in listed.body
			? (listed.body.data as {
					exports: typeof manifest.exports;
					note: string;
				})
			: undefined;
	assert.deepEqual(listedData?.exports, manifest.exports);
	assert.match(listedData?.note ?? "", /source-exact/);

	const downloaded = routeWithCatalog(
		"/v1/exports/small-area-fixture",
		dataCatalog,
		measureObservations,
		{ exportManifest: manifest },
	);
	assert.equal(downloaded.status, 200);
	assert.equal(downloaded.representation?.contentType, "application/json");
	assert.equal(
		downloaded.representation?.headers?.["content-disposition"],
		'attachment; filename="small-area-fixture.json"',
	);
	assert.deepEqual(
		JSON.parse(downloaded.representation?.body ?? "{}"),
		measureObservations[0],
	);
});

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
	// An unknown release lists the releases the geography does have.
	assert.deepEqual(
		"code" in missing.body && [
			missing.body.code,
			missing.body.absence,
			missing.body.availableReleases,
		],
		[
			"unsupported_geography",
			"unknown-release",
			[
				{
					id: "2025-01-en-ward",
					href: "/v1/boundary-releases/ward/2025-01-en-ward",
				},
			],
		],
	);

	const write = route("POST", "/v1/geographies", registry);
	assert.equal(write.status, 405);
	assert.equal(
		"title" in write.body && write.body.title,
		"Method Not Allowed",
	);
});

const validationRoute = (url: string, report?: ValidationReport) =>
	routeRequest(
		"GET",
		url,
		testContext({
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			atlasRelease,
			relationshipCandidateInventory,
			validationReport: report,
		}),
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
	assert.deepEqual(
		"data" in crosswalk.body && crosswalk.body.data,
		validationReport.resources[1],
	);
	for (const [path, resource] of [
		["/v1/validation/measures/crime-total", validationReport.resources[2]],
		[
			"/v1/validation/exports/crime-total-observations",
			validationReport.resources[3],
		],
	] as const) {
		const response = validationRoute(path, validationReport);
		assert.equal(response.status, 200);
		assert.deepEqual(
			"data" in response.body && response.body.data,
			resource,
		);
	}
	for (const path of [
		"/v1/validation/crosswalks/unknown",
		"/v1/validation/measures/unknown",
		"/v1/validation/exports/crime-total-observations/records",
	]) {
		assert.equal(validationRoute(path, validationReport).status, 404);
	}
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

test("measures an area's geometry without returning its coordinates", () => {
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
									[-2, 54],
									[-1, 54],
									[-1, 55],
									[-2, 55],
									[-2, 54],
								],
							],
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
			"/v1/areas/ward/2025-01-en-ward/E05000001/geometry/metadata",
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
		const data = ("data" in response.body && response.body.data) as Record<
			string,
			never
		>;
		// The point of the endpoint: measurements, and no coordinates beyond
		// the three single points that are themselves the answer.
		assert.equal("geometry" in data, false);
		assert.deepEqual(data.boundingBox, [-2, 54, -1, 55]);
		assert.equal(data.labelPointMethod, "centroid");
		assert.deepEqual(data.labelPoint, data.centroid);
		assert.deepEqual(data.geometryExtent, {
			parts: 1,
			rings: 1,
			vertices: 5,
		});

		const area = data.area as unknown as Record<string, number>;
		const perimeter = data.perimeter as unknown as Record<string, number>;
		// A degree of longitude at 54°N is about 65 km, a degree of latitude
		// about 111 km, so the cell is roughly 7,300 km².
		assert.ok(area.km2! > 7_200 && area.km2! < 7_400, `${area.km2} km2`);
		assert.equal(area.hectares, area.m2! / 10_000);
		assert.equal(area.km2, area.m2! / 1_000_000);
		assert.equal(perimeter.km, perimeter.m! / 1000);
		assert.match(
			(data.method as unknown as Record<string, string>).caveat!,
			/not a published land-area statistic/,
		);

		const unknownArea = route(
			"GET",
			"/v1/areas/ward/2025-01-en-ward/E05099999/geometry/metadata",
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

test("refuses to measure geometry that carries no polygon", () => {
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
		const response = route(
			"GET",
			"/v1/areas/ward/2025-01-en-ward/E05000001/geometry/metadata",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			new AreaGeometryCache(root, sources),
		);
		// A point source can still be served as geometry; it just cannot be
		// measured, and says so rather than reporting zero.
		assert.equal(response.status, 422);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("serves geometry at a named generalisation tier", () => {
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
		// A square whose southern edge carries a run of small spikes.
		const south: number[][] = [];
		for (let i = 0; i <= 200; i += 1) {
			south.push([-2 + i / 200, 54 + (i % 2 === 0 ? 0 : 0.0005)]);
		}
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
								[...south, [-1, 55], [-2, 55], [-2, 54]],
							],
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
		const get = (query: string) =>
			route(
				"GET",
				`/v1/areas/ward/2025-01-en-ward/E05000001/geometry${query}`,
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

		const full = get("");
		const coarse = get("?tier=low");
		assert.equal(full.status, 200);
		assert.equal(coarse.status, 200);
		type Generalisation = {
			tier: string;
			toleranceM: number;
			vertices: number;
			verticesAtFullResolution: number;
			method?: Record<string, string>;
		};
		const properties = (response: typeof full) =>
			(
				("data" in response.body && response.body.data) as {
					properties: { generalisation: Generalisation };
				}
			).properties;
		const generalisation = properties(coarse).generalisation;
		assert.equal(generalisation.tier, "low");
		assert.equal(generalisation.toleranceM, 1000);
		assert.ok(
			generalisation.vertices < generalisation.verticesAtFullResolution,
			"coarse tier kept every vertex",
		);
		// The count reported is the count delivered, not merely a claim.
		const coarseGeometry = (
			("data" in coarse.body && coarse.body.data) as {
				geometry: { coordinates: number[][][] };
			}
		).geometry;
		assert.equal(
			coarseGeometry.coordinates.flat().length,
			generalisation.vertices,
		);
		// A generalised response carries the terms it was made on, and says so
		// about shared borders.
		assert.match(generalisation.method!.sharedBorders!, /shared border/);

		// The full tier is the default and explains nothing, having done nothing.
		assert.equal(properties(full).generalisation.tier, "full");
		assert.equal("method" in properties(full).generalisation, false);

		const unknownTier = get("?tier=coarse");
		assert.equal(unknownTier.status, 400);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("draws every child of an area as one FeatureCollection", () => {
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
									[-2, 54],
									[-1, 54],
									[-1, 55],
									[-2, 55],
									[-2, 54],
								],
							],
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
		const get = (query = "") =>
			route(
				"GET",
				`/v1/areas/localAuthority/2025-01-uk-lad/E08000001/children/geometry${query}`,
				registry,
				geographyInventory,
				areaLookup,
				crosswalkInventory,
				crosswalkLookup,
				undefined,
				undefined,
				undefined,
				new AreaGeometryCache(root, sources),
			);

		const response = get();
		assert.equal(response.status, 200);
		const data = ("data" in response.body && response.body.data) as {
			type: string;
			parent: { code: string };
			collection: Record<string, never>;
			withoutGeometry: unknown[];
			features: {
				id: string;
				properties: Record<string, never>;
				geometry: { type: string };
			}[];
		};
		assert.equal(data.type, "FeatureCollection");
		assert.equal(data.parent.code, "E08000001");
		assert.equal(data.collection.members, 1);
		assert.equal(data.collection.withGeometry, 1);
		assert.equal(data.collection.tier, "full");
		assert.deepEqual(data.withoutGeometry, []);
		assert.equal(data.features.length, 1);

		const [child] = data.features;
		assert.equal(child!.id, "ward/2025-01-en-ward/E05000001");
		assert.equal(child!.geometry.type, "Polygon");
		// Membership is the crosswalk's published claim, carried with the
		// feature rather than implied by the collection it arrived in.
		assert.equal(
			(child!.properties.membership as unknown as { method: string })
				.method,
			"clean-containment",
		);

		// A coarser tier reports the method once for the collection, not on
		// every member.
		const coarse = get("?tier=low");
		const coarseData = ("data" in coarse.body && coarse.body.data) as {
			collection: Record<string, never>;
			features: { properties: Record<string, never> }[];
		};
		assert.equal(coarseData.collection.tier, "low");
		assert.ok("generalisationMethod" in coarseData.collection);
		assert.equal(
			"tier" in coarseData.features[0]!.properties.generalisation,
			false,
		);

		assert.equal(get("?tier=nope").status, 400);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("lists the children it could not draw rather than dropping them", () => {
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
		// The source exists but holds no feature for the child's code.
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({ type: "FeatureCollection", features: [] }),
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
		const response = route(
			"GET",
			"/v1/areas/localAuthority/2025-01-uk-lad/E08000001/children/geometry",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			new AreaGeometryCache(root, sources),
		);
		assert.equal(response.status, 200);
		const data = ("data" in response.body && response.body.data) as {
			collection: Record<string, never>;
			withoutGeometry: { code: string; reason: string }[];
			features: unknown[];
		};
		// A partial collection is still a 200, but it says what is missing and
		// why: members and withGeometry disagreeing is the signal.
		assert.equal(data.collection.members, 1);
		assert.equal(data.collection.withGeometry, 0);
		assert.equal(data.features.length, 0);
		assert.equal(data.withoutGeometry.length, 1);
		assert.equal(data.withoutGeometry[0]!.code, "E05000001");
		assert.match(
			data.withoutGeometry[0]!.reason,
			/No feature for this code/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("finds the areas meeting a box, and says how each meets it", () => {
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
									[-2, 54],
									[-1, 54],
									[-1, 55],
									[-2, 55],
									[-2, 54],
								],
							],
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
		const get = (query: string) =>
			route(
				"GET",
				`/v1/areas:intersects?${query}`,
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
		const where = "geography=ward&release=2025-01-en-ward";
		const data = (response: ReturnType<typeof get>) =>
			("data" in response.body && response.body.data) as {
				matched: number;
				returned: number;
				truncated: boolean;
				matches: {
					code: string;
					relation: string;
					boundingBox: number[];
					geometry?: unknown;
					generalisation?: { vertices: number };
				}[];
			} & Record<string, never>;

		// A box that swallows the ward whole.
		const enclosing = get(`bbox=-3,53,0,56&${where}`);
		assert.equal(enclosing.status, 200);
		assert.equal(data(enclosing).matched, 1);
		assert.equal(data(enclosing).matches[0]!.relation, "within");
		assert.deepEqual(
			data(enclosing).matches[0]!.boundingBox,
			[-2, 54, -1, 55],
		);

		// A box that cuts across it.
		const cutting = get(`bbox=-1.5,54.5,0,56&${where}`);
		assert.equal(data(cutting).matches[0]!.relation, "overlaps");

		// A box nowhere near it is an empty answer, not an error.
		const elsewhere = get(`bbox=10,10,11,11&${where}`);
		assert.equal(elsewhere.status, 200);
		assert.equal(data(elsewhere).matched, 0);
		assert.deepEqual(data(elsewhere).matches, []);

		// Identities by default: the coordinates cost extra, and are opted into.
		assert.equal("geometry" in data(enclosing).matches[0]!, false);
		const withGeometry = get(`bbox=-3,53,0,56&${where}&tier=low`);
		assert.ok(data(withGeometry).matches[0]!.geometry);
		assert.equal(data(withGeometry).tier, "low");
		assert.ok(data(withGeometry).matches[0]!.generalisation!.vertices > 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("bounds a box query by result count and rejects a malformed one", () => {
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
									[-2, 54],
									[-1, 54],
									[-1, 55],
									[-2, 55],
									[-2, 54],
								],
							],
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
		const get = (query: string) =>
			route(
				"GET",
				`/v1/areas:intersects?${query}`,
				registry,
				geographyInventory,
				areaLookup,
				crosswalkInventory,
				crosswalkLookup,
				undefined,
				undefined,
				undefined,
				new AreaGeometryCache(root, sources),
			);
		const where = "geography=ward&release=2025-01-en-ward";

		// One match, asked for none of it: still counted, and the cut is stated.
		const limited = get(`bbox=-3,53,0,56&${where}&limit=1`);
		const data = ("data" in limited.body && limited.body.data) as Record<
			string,
			never
		>;
		assert.equal(data.matched, 1);
		assert.equal(data.returned, 1);
		assert.equal(data.truncated, false);

		for (const query of [
			where, // no bbox at all
			`bbox=&${where}`,
			`bbox=1,2,3&${where}`, // three numbers
			`bbox=1,2,3,4,5&${where}`,
			`bbox=a,b,c,d&${where}`,
			`bbox=0,54,-1,55&${where}`, // west east of east
			`bbox=-2,55,-1,54&${where}`, // south north of north
			`bbox=-200,54,-1,55&${where}`, // off the globe
			`bbox=-2,54,-1,55&geography=ward`, // no release
			`bbox=-2,54,-1,55&${where}&limit=0`,
			`bbox=-2,54,-1,55&${where}&limit=1001`,
			`bbox=-2,54,-1,55&${where}&limit=1.5`,
			`bbox=-2,54,-1,55&${where}&tier=nope`,
		]) {
			assert.equal(get(query).status, 400, query);
		}

		// A release the catalogue does not carry is a 404, not a 400: the
		// request was well formed, there is just nothing to search.
		assert.equal(
			get(`bbox=-2,54,-1,55&geography=ward&release=1999-01-en-ward`)
				.status,
			404,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("lists an area's neighbours with the border each shares", () => {
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
		const square = (
			west: number,
			south: number,
			east: number,
			north: number,
		) => [
			[
				[west, south],
				[east, south],
				[east, north],
				[west, north],
				[west, south],
			],
		];
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { WD25CD: "E05000001" },
						geometry: {
							type: "Polygon",
							coordinates: square(-1, 54, 0, 55),
						},
					},
					// Shares the whole eastern edge.
					{
						properties: { WD25CD: "E05000002" },
						geometry: {
							type: "Polygon",
							coordinates: square(0, 54, 1, 55),
						},
					},
					// Meets at the single corner (0, 55) and nowhere else.
					{
						properties: { WD25CD: "E05000003" },
						geometry: {
							type: "Polygon",
							coordinates: square(0, 55, 1, 56),
						},
					},
					// Nowhere near any of them.
					{
						properties: { WD25CD: "E05000004" },
						geometry: {
							type: "Polygon",
							coordinates: square(20, 20, 21, 21),
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
		const get = (query = "") =>
			route(
				"GET",
				`/v1/areas/ward/2025-01-en-ward/E05000001/neighbours${query}`,
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
		const data = (response: ReturnType<typeof get>) =>
			("data" in response.body && response.body.data) as {
				touches: string;
				border: Record<string, number>;
				neighbours: {
					code: string;
					touch: string;
					sharedBorderM: number;
					shareOfPerimeter: number;
					sharedVertices: number;
				}[];
			} & Record<string, never>;

		// By default a corner is not a neighbour.
		const edges = get();
		assert.equal(edges.status, 200);
		assert.equal(data(edges).touches, "edge");
		assert.equal(data(edges).neighbours.length, 1);
		assert.equal(data(edges).neighbours[0]!.code, "E05000002");
		assert.equal(data(edges).neighbours[0]!.touch, "edge");
		// The corner touch is still counted, so a caller can see it was left out.
		assert.equal(data(edges).border.pointOnlyTouches, 1);

		// One side of four shared, but not a quarter of the perimeter: a cell a
		// degree square is a tall rectangle on the ground, 111 km north to
		// south against 65 km east to west, so the shared meridian is nearer a
		// third of the way round.
		const share = data(edges).neighbours[0]!.shareOfPerimeter;
		assert.ok(share > 0.3 && share < 0.33, `share ${share}`);
		assert.ok(
			data(edges).border.unsharedBorderM! >
				data(edges).border.sharedBorderM! * 2,
		);

		// Asking for point touches brings the corner in, with no border length.
		const any = get("?touches=any");
		assert.equal(data(any).neighbours.length, 2);
		const corner = data(any).neighbours.find(
			(neighbour) => neighbour.code === "E05000003",
		)!;
		assert.equal(corner.touch, "point");
		assert.equal(corner.sharedBorderM, 0);
		assert.equal(corner.sharedVertices, 1);
		// Ordered by how much border each shares, so the real one leads.
		assert.equal(data(any).neighbours[0]!.code, "E05000002");

		// The distant ward is in neither answer.
		assert.equal(
			data(any).neighbours.some(
				(neighbour) => neighbour.code === "E05000004",
			),
			false,
		);

		assert.equal(get("?touches=nope").status, 400);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
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
	const context: RouteContext = {
		boundaryRegistry: registry,
		areaLookup,
		crosswalkInventory: inventory,
		crosswalkLookup,
		namedLocationLookup,
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

test("ranks change between two periods of one source partition", () => {
	const context: RouteContext = {
		boundaryRegistry: registry,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	};
	const ask = (measureId: string, query: string) =>
		routeRequest("GET", `/v1/data/${measureId}/change?${query}`, context);
	const partition = "geography=localAuthority&boundaryYear=2023";
	type Record = {
		areaCode: string;
		rank: number;
		tieCount: number;
		start: { period: string; value: number };
		end: { period: string; value: number };
		absoluteChange: number;
		relativeChange: number | null;
	};
	const data = (response: ReturnType<typeof ask>) =>
		(
			response.body as {
				data: {
					change: { direction: string; basis: string; unit: string };
					coverage: { areasRanked: number; onlyAtStart: string[] };
					records: Record[];
				};
			}
		).data;

	// Both authorities grow by 20 people between 2022 and 2024, so absolute
	// change ties them at rank 1, and the next rank would account for both.
	const absolute = ask(
		"population-estimate",
		`${partition}&startPeriod=2022&endPeriod=2024`,
	);
	assert.equal(
		absolute.status,
		200,
		JSON.stringify(absolute.body).slice(0, 300),
	);
	assert.equal(data(absolute).change.direction, "end-minus-start");
	assert.equal(data(absolute).change.unit, "people");
	assert.deepEqual(
		data(absolute).records.map((record) => [record.rank, record.tieCount]),
		[
			[1, 2],
			[1, 2],
		],
	);
	const first = data(absolute).records.find(
		(record) => record.areaCode === "E06000001",
	)!;
	assert.deepEqual(first.start, {
		period: "2022",
		areaCode: "E06000001",
		value: 280,
		status: "observed",
	});
	assert.equal(first.end.value, 300);
	assert.equal(first.absoluteChange, 20);

	// Relative change separates them: 20 on 280 is more than 20 on 380.
	const relative = ask(
		"population-estimate",
		`${partition}&startPeriod=2022&endPeriod=2024&by=relative`,
	);
	assert.equal(data(relative).change.unit, "proportion");
	assert.deepEqual(
		data(relative).records.map((record) => record.areaCode),
		["E06000001", "N09000001"],
	);
	assert.ok(
		Math.abs(data(relative).records[0]!.relativeChange! - 20 / 280) < 1e-12,
	);

	// One area, keeping its place among all of them.
	const one = ask(
		"population-estimate",
		`${partition}&startPeriod=2022&endPeriod=2024&by=relative&areaCode=N09000001`,
	);
	assert.equal(data(one).records.length, 1);
	assert.equal(data(one).records[0]!.rank, 2);
	assert.equal(data(one).coverage.areasRanked, 2);

	// Refusals, each saying how to recover.
	const refusals: [string, string, number, RegExp][] = [
		// The partition's periods are listed, not guessed at.
		[
			"population-estimate",
			`${partition}&startPeriod=2019&endPeriod=2024`,
			400,
			/2022, 2023, 2024/,
		],
		[
			"population-estimate",
			`${partition}&startPeriod=2024&endPeriod=2022`,
			400,
			/before/,
		],
		// Naming no partition lists the partitions that exist.
		[
			"population-estimate",
			"startPeriod=2022&endPeriod=2024",
			400,
			/boundaryYear=2023 \(3 periods\)/,
		],
		// A partition of one period has nothing to change between.
		[
			"ghg-emissions",
			"geography=localAuthority&boundaryYear=2025&startPeriod=2024&endPeriod=2024",
			422,
			/single period/,
		],
		// A single-period partition is refused before the basis is looked at,
		// so a ratio asked for relatively is told there is nothing to change
		// between. The ratio rule itself is covered where it is decided.
		[
			"mobile-5g-coverage",
			"geography=localAuthority&boundaryYear=2024&startPeriod=2025&endPeriod=2025&by=relative",
			422,
			/single period/,
		],
		[
			"population-estimate",
			`${partition}&startPeriod=2022&endPeriod=2024&release=2023-05-uk-bgc-v2`,
			422,
			/one source partition/,
		],
		[
			"population-estimate",
			`${partition}&startPeriod=2022&endPeriod=2024&areaCode=E99999999`,
			404,
			/not in this partition/,
		],
	];
	for (const [measureId, query, status, detail] of refusals) {
		const response = ask(measureId, query);
		assert.equal(response.status, status, `${measureId}?${query}`);
		assert.match((response.body as { detail: string }).detail, detail);
	}
});

test("answers a measure for a place named in words", () => {
	// Names for the two authorities the population fixture carries values for.
	const namedAreas = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:named-areas",
			geography: "localAuthority",
			boundaryRelease: "2023-05-uk-bgc-v2",
			codeProperty: "LAD23CD",
			nameProperty: "LAD23NM",
			areas: [
				{ code: "E06000001", name: "Hartlepool" },
				{ code: "N09000001", name: "Antrim and Newtownabbey" },
			],
		},
	]);
	const context: RouteContext = {
		boundaryRegistry: registry,
		areaLookup: namedAreas,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	};
	const get = (url: string) => routeRequest("GET", url, context);

	const places = get("/v1/places?q=antrim%20%26%20newtownabbey");
	assert.equal(places.status, 200);
	const candidates = (
		places.body as { data: { candidates: { place: string }[] } }
	).data.candidates;
	assert.deepEqual(
		candidates.map((candidate) => candidate.place),
		["localAuthority/N09000001"],
	);

	const answered = get("/v1/data/population-estimate/value?place=Hartlepool");
	assert.equal(
		answered.status,
		200,
		JSON.stringify(answered.body).slice(0, 300),
	);
	const data = (
		answered.body as {
			data: {
				answer: {
					value: number;
					unit: string;
					period: string;
					periodDefaulted: boolean;
				};
				place: { place: string };
				method: string;
				via: string;
				note: string;
			};
		}
	).data;
	// No period asked for, so the latest the partition publishes.
	assert.deepEqual(
		[data.answer.value, data.answer.unit, data.answer.period],
		[300, "people", "2024"],
	);
	assert.equal(data.answer.periodDefaulted, true);
	assert.match(data.note, /latest published, 2024/);
	assert.equal(data.place.place, "localAuthority/E06000001");
	assert.equal(data.method, "source-exact");
	// The route that gives the answer directly is named, and gives the same one.
	const direct = get(data.via);
	assert.equal(direct.status, 200);

	const earlier = get(
		"/v1/data/population-estimate/value?place=Hartlepool&period=2022",
	);
	assert.equal(
		(earlier.body as { data: { answer: { value: number } } }).data.answer
			.value,
		280,
	);

	assert.equal(
		get("/v1/data/population-estimate/value?place=Atlantis").status,
		404,
	);
	assert.equal(get("/v1/data/population-estimate/value").status, 400);
	assert.equal(
		get("/v1/data/no-such-measure/value?place=Hartlepool").status,
		404,
	);
	assert.equal(get("/v1/places").status, 400);
});

const citationRegistry: BoundaryRegistry = {
	...registry,
	releases: [
		...registry.releases,
		{
			id: "2023-05-uk-bgc",
			geography: "ward",
			title: "Wards, May 2023",
			coverage: { countries: ["GB-ENG", "GB-WLS"] },
			source: {
				publisher: "ONS",
				url: "https://example.com/wards-2023",
				retrievedAt: "2026-01-01",
				licence: { name: "Open Government Licence" },
			},
			metadataHash: "sha256:wards-2023-metadata",
		},
		{
			id: "2025-01-uk-lad",
			geography: "localAuthority",
			title: "Local authorities",
			coverage: { countries: ["GB-ENG"] },
			source: {
				publisher: "ONS",
				url: "https://example.com/lad",
				licence: { name: "Open Government Licence" },
			},
			metadataHash: "sha256:lad-metadata",
		},
		// The endpoints of the constituency crosswalk, which maps no ward.
		...["2010", "2024-07-uk-bgc"].map((id) => ({
			id,
			geography: "constituency",
			title: `Constituencies ${id}`,
			coverage: { countries: ["GB-ENG"] },
			source: {
				publisher: "ONS",
				url: "https://example.com/constituencies",
				licence: { name: "Open Government Licence" },
			},
			metadataHash: `sha256:constituency-${id}-metadata`,
		})),
	],
};

const citationContext = {
	boundaryRegistry: citationRegistry,
	areaInventory: {
		schemaVersion: 1,
		contentHash: "sha256:area-inventory",
		boundaryRegistryHash: "sha256:registry",
		releases: [
			{
				id: "2025-01-en-ward",
				geography: "ward",
				status: "available",
				recordCount: 2,
				artifact: "areas/ward/2025-01-en-ward.json",
				contentHash: "sha256:areas",
				codeProperty: "WD25CD",
				nameProperty: "WD25NM",
			},
		],
	},
	areaLookup: new Map([...areaLookup, ...compatibleWardAreaLookup]),
	crosswalkInventory: {
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
	},
	crosswalkLookup,
	atlasRelease,
	validationReport,
	dataCatalog: {
		...dataCatalog,
		datasets: [
			...dataCatalog.datasets,
			{
				...dataCatalog.datasets[0]!,
				id: "population-uk",
				label: "Population (UK)",
			},
		],
	},
	populationObservations,
	populationLocalAuthorityObservations,
	measureObservations,
	measureCompatibilityInventory,
} satisfies RouteContext;

const citation = (url: string, context: RouteContext = citationContext) => {
	const response = routeRequest("GET", url, context);
	return {
		status: response.status,
		data: ("data" in response.body ? response.body.data : undefined) as
			Record<string, unknown> | undefined,
		detail: "detail" in response.body ? response.body.detail : undefined,
	};
};

test("cites an area with its release, identity hash, validation and attribution", () => {
	const { status, data } = citation(
		"/v1/areas/ward/2025-01-en-ward/E05000001/citation?crosswalk=ward-to-local-authority-2025",
	);
	assert.equal(status, 200);
	assert.ok(data);
	assert.deepEqual(data.atlasRelease, {
		id: "sha256:atlas-release",
		href: "/v1/atlas-releases/sha256:atlas-release",
	});
	assert.deepEqual(data.identity, {
		status: "available",
		artifact: "areas/ward/2025-01-en-ward.json",
		contentHash: "sha256:areas",
	});
	assert.deepEqual(data.boundary, {
		id: "ward/2025-01-en-ward",
		title: "Ward boundaries",
		publisher: "ONS",
		sourceUrl: "https://example.com/source",
		licence: { name: "Open Government Licence" },
		metadataHash: "sha256:metadata",
		href: "/v1/boundary-releases/ward/2025-01-en-ward",
	});
	assert.equal(
		(data.geometry as { hash: { status: string } }).hash.status,
		"not-published",
	);
	assert.deepEqual(data.crosswalks, [
		{
			id: "ward-to-local-authority-2025",
			method: "clean-containment",
			quality: "publisher-supplied",
			from: { geography: "ward", boundaryRelease: "2025-01-en-ward" },
			to: {
				geography: "localAuthority",
				boundaryRelease: "2025-01-uk-lad",
			},
			contentHash: "sha256:containment-artifact",
			provenance: { input: "lookup.geojson", inputHash: "sha256:input" },
			href: "/v1/crosswalks/ward-to-local-authority-2025",
		},
	]);
	assert.deepEqual(data.validation, {
		status: "available",
		reportHash: "sha256:validation",
		resources: [
			{ id: "atlas", status: "not-validated" },
			{
				...validationReport.resources[0],
				href: "/v1/validation/boundary-releases/ward/2025-01-en-ward",
			},
			{
				id: "crosswalks/ward-to-local-authority-2025",
				status: "not-validated",
			},
		],
	});
	assert.deepEqual(
		(data.resources as Array<{ id: string }>).map(
			(resource) => resource.id,
		),
		[
			"ward/2025-01-en-ward",
			"localAuthority/2025-01-uk-lad",
			"ward-to-local-authority-2025",
		],
	);
	assert.match(
		data.text as string,
		/Compiled by the UK Data Atlas, release sha256:atlas-release\.$/,
	);
});

test("cites a measure through the observations holding the area's value", () => {
	const { status, data } = citation(
		"/v1/areas/ward/2023-05-uk-bgc/E05000001/citation?measure=population-estimate",
	);
	assert.equal(status, 200);
	assert.ok(data);
	assert.deepEqual(data.identity, { status: "not-published" });
	assert.deepEqual(data.measures, [
		{
			id: "population-estimate",
			label: "Population estimate",
			href: "/v1/measures/population-estimate",
			sources: [
				{
					dataset: {
						id: "population",
						href: "/v1/datasets/population",
					},
					sourceGeography: { type: "ward", boundaryYear: 2023 },
					codeSetCompatibility: {
						status: "code-set-compatible",
						eligibleForCodeJoin: true,
					},
					periods: [
						{
							period: "2022",
							artifact: "population-observations",
							contentHash: "sha256:population-observations",
							status: "observed",
						},
					],
				},
			],
		},
	]);
	// The measure's local-authority partition holds nothing for a ward, so
	// its dataset is not credited.
	assert.deepEqual(
		(data.resources as Array<{ id: string }>).map(
			(resource) => resource.id,
		),
		["population", "ward/2023-05-uk-bgc"],
	);
});

test("refuses to cite a resource that supplies nothing for the area", () => {
	const unrelatedCrosswalk = citation(
		"/v1/areas/ward/2025-01-en-ward/E05000001/citation?crosswalk=constituency-2010-to-2024",
	);
	assert.equal(unrelatedCrosswalk.status, 422);
	assert.equal(
		unrelatedCrosswalk.detail,
		"crosswalk=constituency-2010-to-2024 publishes no relationship for ward/2025-01-en-ward/E05000001.",
	);
	const unassessedMeasure = citation(
		"/v1/areas/ward/2025-01-en-ward/E05000001/citation?measure=population-estimate",
	);
	assert.equal(unassessedMeasure.status, 422);
	assert.equal(
		unassessedMeasure.detail,
		"measure=population-estimate publishes no observation for ward/2025-01-en-ward/E05000001 in a source assessed against this boundary release.",
	);
	assert.equal(
		citation(
			"/v1/areas/ward/2025-01-en-ward/E05000001/citation?measure=unknown",
		).status,
		404,
	);
	assert.equal(
		citation("/v1/areas/ward/2025-01-en-ward/E05999999/citation").status,
		404,
	);
	assert.equal(
		citation("/v1/areas/ward/2025-01-en-ward/E05000001/citation", {
			...citationContext,
			dataCatalog: undefined,
		}).status,
		503,
	);
});

test("explains why an area identity resolves to nothing", () => {
	const unknownCode = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05999999/relationships",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(unknownCode.status, 404);
	assert.deepEqual(unknownCode.body, {
		type: "https://api.ukdataatlas.com/problems/not-found",
		title: "Not Found",
		status: 404,
		detail: "E05999999 is held by no compiled release of this geography.",
		code: "area_not_in_release",
		absence: "unknown",
		presentIn: [],
	});
	const unknownRelease = route(
		"GET",
		"/v1/areas/ward/2019-12-en-ward/E05000001",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(unknownRelease.status, 404);
	assert.deepEqual(unknownRelease.body, {
		type: "https://api.ukdataatlas.com/problems/not-found",
		title: "Not Found",
		status: 404,
		detail: "No ward boundary release is published as 2019-12-en-ward.",
		code: "unsupported_geography",
		absence: "unknown-release",
		availableReleases: [
			{
				id: "2025-01-en-ward",
				href: "/v1/boundary-releases/ward/2025-01-en-ward",
			},
		],
	});
});

test("measures how two areas overlap beside any published relationship", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const square = (
			west: number,
			south: number,
			east: number,
			north: number,
		) => ({
			type: "Polygon",
			coordinates: [
				[
					[west, south],
					[east, south],
					[east, north],
					[west, north],
					[west, south],
				],
			],
		});
		const write = (
			path: string,
			codeProperty: string,
			features: Array<[string, unknown]>,
		) => {
			mkdirSync(join(root, "data", path, ".."), { recursive: true });
			writeFileSync(
				join(root, "data", path),
				JSON.stringify({
					type: "FeatureCollection",
					features: features.map(([code, geometry]) => ({
						properties: { [codeProperty]: code },
						geometry,
					})),
				}),
			);
		};
		write("boundaries/ward/2025-01-en-ward/wards.geojson", "WD25CD", [
			["E05000001", square(-1, 54, -0.5, 54.5)],
		]);
		write(
			"boundaries/local-authority/2025-01-uk-lad/lad.geojson",
			"LAD25CD",
			[["E08000001", square(-1, 54, 0, 55)]],
		);
		const context = {
			boundaryRegistry: registry,
			areaLookup,
			crosswalkLookup,
			areaGeometryCache: new AreaGeometryCache(
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
					[
						"localAuthority/2025-01-uk-lad",
						{
							input: "boundaries/local-authority/2025-01-uk-lad/lad.geojson",
							crs: "EPSG:4326",
							codeProperty: "LAD25CD",
						},
					],
				]),
			),
		} satisfies RouteContext;
		const url = "/v1/areas/ward/2025-01-en-ward/E05000001/overlap";

		const response = routeRequest(
			"GET",
			`${url}?with=localAuthority/2025-01-uk-lad/E08000001`,
			context,
		);
		assert.equal(response.status, 200);
		const data = (response.body as { data: Record<string, unknown> }).data;
		assert.equal(data.relation, "within");
		const overlap = data.overlap as {
			shareOfFirst: number;
			shareOfSecond: number;
			pieceCount: number;
		};
		assert.equal(overlap.shareOfFirst, 1);
		assert.ok(overlap.shareOfSecond > 0.24 && overlap.shareOfSecond < 0.26);
		assert.equal(overlap.pieceCount, 1);
		assert.deepEqual(
			(
				data.publishedRelationships as Array<{
					relation: string;
					crosswalk: { id: string };
				}>
			).map((relationship) => [
				relationship.relation,
				relationship.crosswalk.id,
			]),
			[["within", "ward-to-local-authority-2025"]],
		);
		assert.equal(
			(data.method as { sliverWidthM: number }).sliverWidthM,
			100,
		);

		assert.equal(routeRequest("GET", url, context).status, 400);
		const missingOther = routeRequest(
			"GET",
			`${url}?with=ward/2025-01-en-ward/E05999999`,
			context,
		);
		assert.equal(missingOther.status, 404);
		assert.equal(
			"code" in missingOther.body && missingOther.body.code,
			"area_not_in_release",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("validates a batch of codes and names against one release", () => {
	const context = {
		boundaryRegistry: registry,
		areaLookup,
	} satisfies RouteContext;
	const validate = (query: string) =>
		routeRequest("GET", `/v1/areas:validate?${query}`, context);

	const response = validate(
		"geography=ward&release=2025-01-en-ward&value=E05000001&value=enghraifft%20ward&value=E05999999",
	);
	assert.equal(response.status, 200);
	const data = (
		response.body as {
			data: {
				summary: {
					byStatus: Record<string, number>;
					joinable: boolean;
				};
				values: Array<{ status: string; match?: string }>;
			};
		}
	).data;
	assert.deepEqual(
		data.values.map((value) => value.status),
		["valid", "matched", "unknown"],
	);
	assert.equal(data.values[1]?.match, "alias");
	assert.equal(data.summary.joinable, false);

	assert.equal(validate("geography=ward&value=E05000001").status, 400);
	assert.equal(
		validate("geography=ward&release=2025-01-en-ward").status,
		400,
	);
	assert.equal(
		validate(
			`geography=ward&release=2025-01-en-ward&${Array.from({ length: 501 }, () => "value=x").join("&")}`,
		).status,
		400,
	);
	const unknownRelease = validate(
		"geography=ward&release=2019-12-en-ward&value=E05000001",
	);
	assert.equal(unknownRelease.status, 404);
	assert.equal(
		"code" in unknownRelease.body && unknownRelease.body.code,
		"unsupported_geography",
	);
});
