import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import { AreaGeometryCache } from "../src/areaGeometry";
import { route as routeRequest } from "../src/routes";
import type { RouteContext } from "../src/routing";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import {
	route,
	registry,
	geographyInventory,
	areaLookup,
	compatibleWardAreaLookup,
	crosswalkInventory,
	containmentCrosswalk,
	crosswalkLookup,
	dataCatalog,
	measureObservations,
	populationObservations,
	populationLocalAuthorityObservations,
	measureCompatibilityInventory,
	atlasRelease,
	validationReport,
} from "./routeFixtures";

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
