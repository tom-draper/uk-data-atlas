import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test, { after } from "node:test";
import { AreaGeometryCache } from "../src/areaGeometry";
import { createAreaLookup } from "../src/areaInventory";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import { createGeographyResolver } from "../src/geographyResolver";
import { route } from "../src/routes";
import type { RouteContext } from "../src/routing";

// A country of two squares a hundredth of a degree across, England below
// Wales, each divided into areas. The sea lies anywhere else.
const U = 0.01;
const square = (x0: number, y0: number, x1: number, y1: number) => ({
	type: "Polygon",
	coordinates: [
		[
			[x0 * U, y0 * U],
			[x1 * U, y0 * U],
			[x1 * U, y1 * U],
			[x0 * U, y1 * U],
			[x0 * U, y0 * U],
		],
	],
});

const release = (geography: string, id: string, countries: string[]) => ({
	id,
	geography,
	title: `${geography} ${id}`,
	coverage: { countries },
	source: {
		publisher: "ONS",
		url: "https://example.com",
		licence: { name: "Open Government Licence" },
	},
	metadataHash: `sha256:${id}`,
});

const UK = ["GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS"];

const boundaryRegistry: BoundaryRegistry = {
	schemaVersion: 1,
	contentHash: "sha256:registry",
	releases: [
		release("ward", "2024-12-uk-bgc", UK),
		release("ward", "2025-05-uk-bgc", UK),
		release("localHealthBoard", "2023-12-w-bgc", ["GB-WLS"]),
		release("country", "2024-12-uk-bgc", UK),
		release("parish", "2025-05-ew-bgc", ["GB-ENG", "GB-WLS"]),
		release("parish", "2025-05-ew-bfc", ["GB-ENG", "GB-WLS"]),
		release("region", "2025-12-en-bgc", ["GB-ENG"]),
	],
};

const identities = (
	geography: string,
	boundaryRelease: string,
	areas: Array<{ code: string; name: string }>,
) => ({
	schemaVersion: 1 as const,
	contentHash: `sha256:${geography}-${boundaryRelease}`,
	geography,
	boundaryRelease,
	codeProperty: "CODE",
	nameProperty: "NAME",
	areas,
});

const wards = [
	{ code: "E05000001", name: "West ward", geometry: square(0, 0, 1, 1) },
	{ code: "E05000002", name: "East ward", geometry: square(1, 0, 2, 1) },
	{ code: "W05000001", name: "Welsh ward", geometry: square(0, 1, 2, 2) },
];
const healthBoards = [
	{ code: "W11000001", name: "Health board", geometry: square(0, 1, 2, 2) },
];
const countries = [
	{ code: "E92000001", name: "England", geometry: square(0, 0, 2, 1) },
	{ code: "W92000004", name: "Wales", geometry: square(0, 1, 2, 2) },
];

const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-point-lookup-"));
after(() => rmSync(root, { recursive: true, force: true }));

const geometrySources = new Map<
	string,
	{ input: string; crs: string; codeProperty: string }
>();
const publish = (
	geography: string,
	boundaryRelease: string,
	features: Array<{ code: string; geometry: unknown }>,
) => {
	const directory = join(
		root,
		"data",
		"boundaries",
		geography,
		boundaryRelease,
	);
	mkdirSync(directory, { recursive: true });
	writeFileSync(
		join(directory, "areas.geojson"),
		JSON.stringify({
			type: "FeatureCollection",
			features: features.map(({ code, geometry }) => ({
				properties: { CODE: code },
				geometry,
			})),
		}),
	);
	geometrySources.set(`${geography}/${boundaryRelease}`, {
		input: `boundaries/${geography}/${boundaryRelease}/areas.geojson`,
		crs: "EPSG:4326",
		codeProperty: "CODE",
	});
};
publish("ward", "2024-12-uk-bgc", wards);
publish("ward", "2025-05-uk-bgc", wards);
publish("localHealthBoard", "2023-12-w-bgc", healthBoards);
publish("country", "2024-12-uk-bgc", countries);

const named = (areas: Array<{ code: string; name: string }>) =>
	areas.map(({ code, name }) => ({ code, name }));
const areaLookup = createAreaLookup([
	identities("ward", "2024-12-uk-bgc", named(wards)),
	identities("ward", "2025-05-uk-bgc", named(wards)),
	identities("localHealthBoard", "2023-12-w-bgc", named(healthBoards)),
	identities("country", "2024-12-uk-bgc", named(countries)),
	identities("parish", "2025-05-ew-bgc", []),
	identities("parish", "2025-05-ew-bfc", []),
	// Identities compiled, but no geometry source registered.
	identities("region", "2025-12-en-bgc", [
		{ code: "E12000001", name: "North East" },
	]),
]);

const context = (withGeometry = true): RouteContext => ({
	boundaryRegistry,
	geographyResolver: createGeographyResolver({
		boundaryRegistry,
		areaLookup,
		...(withGeometry
			? {
					areaGeometryCache: new AreaGeometryCache(
						root,
						geometrySources,
						6,
					),
				}
			: {}),
	}),
});
const lookupContext = context();

const get = (url: string, routeContext = lookupContext) => {
	const response = route("GET", url, routeContext);
	return {
		status: response.status,
		body: response.body as Record<string, any>,
		data: (response.body as { data?: any }).data,
	};
};

test("looks a point up in several geographies, choosing each release by date", () => {
	const { status, data } = get(
		`/v1/areas:contains?lng=${0.5 * U}&lat=${0.5 * U}&geography=ward&geography=localHealthBoard&date=2025-06-15`,
	);
	assert.equal(status, 200);
	assert.equal(data.date, "2025-06-15");
	assert.deepEqual(data.country, {
		code: "GB-ENG",
		determinedBy: "area-code",
		area: "ward/2025-05-uk-bgc/E05000001",
	});
	const [ward, healthBoard] = data.results;
	assert.equal(ward.boundaryRelease, "2025-05-uk-bgc");
	assert.deepEqual(ward.selection, {
		policy: "latest-release-dated-on-or-before",
		date: "2025-06-15",
		sameMonth: false,
		next: null,
	});
	assert.equal(ward.status, "matched");
	assert.deepEqual(ward.boundaryResolution, {
		generalisation: "generalised-20m",
		extent: "clipped-to-coastline",
		toleranceM: 20,
		basis: "ons-release-name",
	});
	assert.deepEqual(ward.geometrySource, { sourceCrs: "EPSG:4326" });
	assert.ok(
		Math.abs(
			ward.positionalToleranceM -
				(data.point.precision.uncertaintyM + 20),
		) < 0.01,
	);
	assert.deepEqual(
		ward.matches.map(({ id, containment, nearBoundary }: any) => ({
			id,
			containment,
			nearBoundary,
		})),
		[
			{
				id: "ward/2025-05-uk-bgc/E05000001",
				containment: "interior",
				nearBoundary: false,
			},
		],
	);
	// Half a hundredth of a degree from each edge at the equator.
	assert.ok(Math.abs(ward.matches[0].distanceToBoundaryM - 552.8) < 1);

	assert.equal(healthBoard.boundaryRelease, "2023-12-w-bgc");
	assert.equal(healthBoard.status, "outside-coverage");
	assert.equal(healthBoard.reason, "country-not-covered");
	assert.deepEqual(healthBoard.matches, []);
});

test("returns every area on a shared border, flagged as near it", () => {
	const { data } = get(
		`/v1/areas:contains?lng=${1 * U}&lat=${0.5 * U}&release=ward/2024-12-uk-bgc`,
	);
	const [ward] = data.results;
	assert.deepEqual(ward.selection, { policy: "pinned" });
	assert.deepEqual(
		ward.matches.map(
			({
				code,
				containment,
				distanceToBoundaryM,
				nearBoundary,
			}: any) => ({
				code,
				containment,
				distanceToBoundaryM,
				nearBoundary,
			}),
		),
		[
			{
				code: "E05000001",
				containment: "boundary",
				distanceToBoundaryM: 0,
				nearBoundary: true,
			},
			{
				code: "E05000002",
				containment: "boundary",
				distanceToBoundaryM: 0,
				nearBoundary: true,
			},
		],
	);
});

test("reads a stated accuracy in place of the written precision", () => {
	const written = get(
		`/v1/areas:contains?lng=0.00500&lat=0.005&geography=ward&release=2024-12-uk-bgc`,
	).data;
	assert.deepEqual(written.point.precision.decimalPlaces, { lng: 5, lat: 3 });
	assert.equal(written.point.precision.basis, "decimal-places");
	// The coarser axis sets the uncertainty: half of 0.001° of latitude.
	assert.ok(Math.abs(written.point.precision.uncertaintyM - 55.3) < 0.1);

	const stated = get(
		`/v1/areas:contains?lng=0.005&lat=0.005&accuracy=600&geography=ward&release=2024-12-uk-bgc`,
	).data;
	assert.deepEqual(stated.point.precision, {
		decimalPlaces: { lng: 3, lat: 3 },
		uncertaintyM: 600,
		basis: "stated-accuracy",
	});
	assert.equal(stated.results[0].positionalToleranceM, 620);
	assert.equal(stated.results[0].matches[0].nearBoundary, true);
});

test("accepts British National Grid and Irish Grid coordinates at point endpoints", () => {
	const bng = get(
		"/v1/areas:contains?crs=EPSG:27700&easting=530000&northing=180000&release=ward/2024-12-uk-bgc",
	);
	assert.equal(bng.status, 200);
	assert.deepEqual(bng.data.point.input, {
		crs: "EPSG:27700",
		easting: 530000,
		northing: 180000,
		transformation: {
			name: "OSGB36 to WGS 84 (6)",
			epsg: "EPSG:1314",
			accuracyM: 2,
			areaOfUse: "Great Britain onshore and the Isle of Man.",
		},
	});
	assert.equal(
		bng.data.point.precision.basis,
		"decimal-places-and-transformation",
	);
	assert.equal(
		get(
			"/v1/areas:containsBatch?crs=EPSG:29902&point=333500,373500,4&release=ward/2024-12-uk-bgc",
		).data.points[0].point.input.transformation.epsg,
		"EPSG:1641",
	);
	assert.equal(
		get(
			"/v1/areas:near?crs=EPSG:27700&easting=530000&northing=180000&release=ward/2024-12-uk-bgc",
		).data.point.input.crs,
		"EPSG:27700",
	);
	assert.equal(
		get(
			"/v1/areas:contains?crs=EPSG:27700&gridref=TQ3000080000&release=ward/2024-12-uk-bgc",
		).data.point.input.gridReference.value,
		"TQ 30000 80000",
	);
	assert.equal(
		get(
			"/v1/areas:containsBatch?crs=EPSG:27700&point=TQ3000080000,4&release=ward/2024-12-uk-bgc",
		).data.points[0].point.precision.basis,
		"stated-accuracy-and-grid-reference-and-transformation",
	);
	assert.equal(
		get(
			"/v1/areas:near?crs=EPSG:27700&gridref=TQ3000080000&release=ward/2024-12-uk-bgc",
		).data.point.input.gridReference.position,
		"cell-centre",
	);
	assert.equal(
		get(
			"/v1/areas:contains?crs=EPSG:3857&lng=0&lat=0&release=ward/2024-12-uk-bgc",
		).status,
		400,
	);
});

test("places a point outside every country boundary as outside coverage", () => {
	const { data } = get(
		`/v1/areas:contains?lng=0.5&lat=0.5&release=ward/2024-12-uk-bgc`,
	);
	assert.deepEqual(data.country, {
		code: null,
		determinedBy: "country-boundary",
		boundaryRelease: "2024-12-uk-bgc",
	});
	assert.equal(data.results[0].status, "outside-coverage");
	assert.equal(data.results[0].reason, "outside-uk-boundaries");
});

test("reports a date no release fits, or several fit, per geography", () => {
	const { status, data } = get(
		`/v1/areas:contains?lng=${0.5 * U}&lat=${0.5 * U}&geography=parish&geography=ward&date=2025-05`,
	);
	assert.equal(status, 200);
	const [parish, ward] = data.results;
	assert.equal(parish.status, "ambiguous-release");
	assert.deepEqual(
		parish.choices.map((choice: { id: string }) => choice.id),
		["2025-05-ew-bfc", "2025-05-ew-bgc"],
	);
	assert.deepEqual(parish.matches, []);
	assert.equal(ward.status, "matched");

	const early = get(
		`/v1/areas:contains?lng=${0.5 * U}&lat=${0.5 * U}&geography=ward&date=2020-01`,
	).data.results[0];
	assert.equal(early.status, "no-release-for-date");
	assert.equal(early.earliest.id, "2024-12-uk-bgc");
});

test("says when a selected release has no geometry to test", () => {
	const { data } = get(
		`/v1/areas:contains?lng=${0.5 * U}&lat=${0.5 * U}&release=region/2025-12-en-bgc`,
	);
	assert.equal(data.results[0].status, "geometry-unavailable");
	assert.match(data.results[0].detail, /No raw geometry source/);
});

test("refuses a lookup whose point or release selection is unclear", () => {
	const point = `lng=${0.5 * U}&lat=${0.5 * U}`;
	for (const query of [
		"lng=181&lat=0&geography=ward&release=2024-12-uk-bgc",
		"lng=5e-3&lat=0&geography=ward&release=2024-12-uk-bgc",
		`${point}&geography=ward&geography=country&release=2024-12-uk-bgc`,
		`${point}&geography=ward`,
		`${point}&geography=ward&date=2025-02-30`,
		`${point}&release=ward/2024-12-uk-bgc&release=ward/2025-05-uk-bgc`,
		`${point}&geography=a&geography=b&geography=c&geography=d&geography=e&date=2025-01`,
		`${point}&geography=ward&release=2024-12-uk-bgc&accuracy=-5`,
	])
		assert.equal(get(`/v1/areas:contains?${query}`).status, 400, query);

	const unknownRelease = get(
		`/v1/areas:contains?${point}&release=ward/2019-12-uk-bgc`,
	);
	assert.equal(unknownRelease.status, 404);
	const unknownGeography = get(
		`/v1/areas:contains?${point}&geography=nowhere&date=2025-01`,
	);
	assert.equal(unknownGeography.status, 404);
	assert.equal(unknownGeography.body.code, "unsupported_geography");

	assert.equal(
		get(
			`/v1/areas:contains?${point}&release=ward/2024-12-uk-bgc`,
			context(false),
		).status,
		503,
	);
});

test("ranks nearby areas by distance without claiming containment", () => {
	const { status, data } = get(
		`/v1/areas:near?lng=${2.5 * U}&lat=${0.5 * U}&release=ward/2024-12-uk-bgc&limit=2&within=2000`,
	);
	assert.equal(status, 200);
	assert.equal(data.relation, "distance");
	const [ward] = data.results;
	assert.equal(ward.status, "found");
	assert.equal(ward.matched, 3);
	assert.equal(ward.truncated, true);
	assert.deepEqual(
		ward.nearest.map(({ rank, code }: any) => ({ rank, code })),
		[
			{ rank: 1, code: "E05000002" },
			{ rank: 2, code: "W05000001" },
		],
	);
	assert.ok(Math.abs(ward.nearest[0].distanceM - 556.6) < 1);
	assert.ok(!("containment" in ward.nearest[0]));

	const inside = get(
		`/v1/areas:near?lng=${0.5 * U}&lat=${0.5 * U}&release=ward/2024-12-uk-bgc`,
	).data.results[0];
	assert.equal(inside.nearest[0].code, "E05000001");
	assert.equal(inside.nearest[0].distanceM, 0);

	const far = get(
		`/v1/areas:near?lng=0.5&lat=0.5&release=ward/2024-12-uk-bgc&within=50000`,
	).data.results[0];
	assert.equal(far.status, "none-within");
	assert.deepEqual(far.nearest, []);

	for (const query of ["limit=11", "limit=0", "within=50001", "within=1.5"])
		assert.equal(
			get(
				`/v1/areas:near?lng=0&lat=0&release=ward/2024-12-uk-bgc&${query}`,
			).status,
			400,
			query,
		);
});

test("looks up a bounded batch of points one release at a time", () => {
	const { status, data } = get(
		`/v1/areas:containsBatch?point=${0.5 * U},${0.5 * U}&point=${0.5 * U},${1.5 * U},30&point=0.5,0.5&geography=ward&geography=localHealthBoard&date=2025-01`,
	);
	assert.equal(status, 200);
	assert.deepEqual(
		data.releases.map(({ geography, boundaryRelease }: any) => [
			geography,
			boundaryRelease,
		]),
		[
			["ward", "2024-12-uk-bgc"],
			["localHealthBoard", "2023-12-w-bgc"],
		],
	);
	assert.deepEqual(data.summary, {
		points: 3,
		lookups: 6,
		matched: 3,
		noMatch: 0,
		outsideCoverage: 3,
		unresolved: 0,
		nearBoundary: 0,
	});
	assert.deepEqual(
		data.points.map(({ index, country, results }: any) => ({
			index,
			country: country.code,
			results: results.map(({ status, matches }: any) => [
				status,
				matches.map((match: { code: string }) => match.code),
			]),
		})),
		[
			{
				index: 0,
				country: "GB-ENG",
				results: [
					["matched", ["E05000001"]],
					["outside-coverage", []],
				],
			},
			{
				index: 1,
				country: "GB-WLS",
				results: [
					["matched", ["W05000001"]],
					["matched", ["W11000001"]],
				],
			},
			{
				index: 2,
				country: null,
				results: [
					["outside-coverage", []],
					["outside-coverage", []],
				],
			},
		],
	);
	assert.equal(data.points[1].point.precision.uncertaintyM, 30);
	assert.ok(!("geometrySource" in data.points[0].results[0].matches[0]));

	const release = "geography=ward&release=2024-12-uk-bgc";
	for (const query of [
		release,
		`point=1&${release}`,
		`point=0,0,0&${release}`,
		`point=0,0,1,2&${release}`,
		`${Array.from({ length: 101 }, () => "point=0,0").join("&")}&${release}`,
	])
		assert.equal(
			get(`/v1/areas:containsBatch?${query}`).status,
			400,
			query.slice(0, 40),
		);
});
