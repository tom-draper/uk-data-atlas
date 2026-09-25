import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { AreaGeometryCache } from "../src/areaGeometry";
import { createAreaLookup } from "../src/areaInventory";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import { createGeographyResolver } from "../src/geographyResolver";
import { NORTHERN_IRELAND_EXCLUSION } from "../src/postcodes";
import { toWgs84Point } from "../src/reprojection";
import { route } from "../src/routes";
import type { RouteContext } from "../src/routing";
import { postcodeIndexFor, postcodeRow } from "./postcodeFixtures";

// Areas a kilometre or so across, west and east of a point in London, so the
// postcodes below can carry real British National Grid references.
const [lng, lat] = toWgs84Point([530000, 180000], "EPSG:27700").position;
const D = 0.02;
const square = (x0: number, x1: number) => ({
	type: "Polygon",
	coordinates: [
		[
			[lng + x0 * D, lat - D],
			[lng + x1 * D, lat - D],
			[lng + x1 * D, lat + D],
			[lng + x0 * D, lat + D],
			[lng + x0 * D, lat - D],
		],
	],
});

const release = (geography: string, id: string) => ({
	id,
	geography,
	title: `${geography} ${id}`,
	coverage: { countries: ["GB-ENG"] },
	source: {
		publisher: "ONS",
		url: "https://example.com",
		licence: { name: "Open Government Licence" },
	},
	metadataHash: `sha256:${id}`,
});

const layers = {
	"localAuthority/2026-05-uk-bgc": [
		{ code: "E09000001", name: "West borough", geometry: square(-1, 0) },
		{ code: "E09000002", name: "East borough", geometry: square(0, 1) },
	],
	// Newer than the directory's edition, so chosen only when asked for.
	"localAuthority/2026-12-uk-bgc": [
		{ code: "E09000003", name: "Merged borough", geometry: square(-1, 1) },
	],
	"ward/2026-05-uk-bgc": [
		{ code: "E05000001", name: "West ward", geometry: square(-1, 0) },
		{ code: "E05000002", name: "East ward", geometry: square(0, 1) },
	],
	"constituency/2024-07-uk-bgc": [
		{ code: "E14000001", name: "Constituency", geometry: square(-1, 1) },
	],
	"country/2025-12-uk-bgc": [
		{ code: "E92000001", name: "England", geometry: square(-1, 1) },
	],
};

const boundaryRegistry: BoundaryRegistry = {
	schemaVersion: 1,
	contentHash: "sha256:registry",
	releases: Object.keys(layers).map((key) => {
		const [geography, id] = key.split("/");
		return release(geography!, id!);
	}),
};

const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-postcodes-"));
after(() => rmSync(root, { recursive: true, force: true }));
const geometrySources = new Map<
	string,
	{ input: string; crs: string; codeProperty: string }
>();
for (const [key, features] of Object.entries(layers)) {
	mkdirSync(join(root, "data", "boundaries", key), { recursive: true });
	writeFileSync(
		join(root, "data", "boundaries", key, "areas.geojson"),
		JSON.stringify({
			type: "FeatureCollection",
			features: features.map(({ code, geometry }) => ({
				properties: { CODE: code },
				geometry,
			})),
		}),
	);
	geometrySources.set(key, {
		input: `boundaries/${key}/areas.geojson`,
		crs: "EPSG:4326",
		codeProperty: "CODE",
	});
}
const areaLookup = createAreaLookup(
	Object.entries(layers).map(([key, features]) => {
		const [geography, boundaryRelease] = key.split("/");
		return {
			schemaVersion: 1 as const,
			contentHash: `sha256:${key}`,
			geography: geography!,
			boundaryRelease: boundaryRelease!,
			codeProperty: "CODE",
			nameProperty: "NAME",
			areas: features.map(({ code, name }) => ({ code, name })),
		};
	}),
);

const { index } = postcodeIndexFor([
	// 300 m west and east of the centre line.
	postcodeRow("EC1A 1AA", { east1m: "529700" }),
	postcodeRow("EC1A 1AB", { east1m: "530300", doterm: "201905" }),
	postcodeRow("EC1A 1AD", { east1m: "529700", gridind: "5" }),
	postcodeRow("GY1 1AA", {
		gridind: "9",
		east1m: "",
		north1m: "",
		ctry: "L93000001",
	}),
	postcodeRow("BT1 1AA", { ctry: "N92000002" }),
]);

const context = (withPostcodes = true): RouteContext => ({
	boundaryRegistry,
	geographyResolver: createGeographyResolver({
		boundaryRegistry,
		areaLookup,
		areaGeometryCache: new AreaGeometryCache(root, geometrySources, 6),
		...(withPostcodes ? { postcodeIndex: index } : {}),
	}),
});
const postcodeContext = context();

const get = (url: string, routeContext = postcodeContext) => {
	const response = route("GET", url, routeContext);
	return {
		status: response.status,
		body: response.body as Record<string, any>,
		data: (response.body as { data?: any }).data,
	};
};

const matched = (result: { matches: Array<{ id: string }> }) =>
	result.matches.map((match) => match.id);

test("places a postcode in its local authority, ward and constituency as at the directory's edition", () => {
	const { status, data } = get("/v1/postcodes/ec1a1aa");
	assert.equal(status, 200);
	assert.equal(data.postcode, "EC1A 1AA");
	assert.equal(data.status, "live");
	assert.equal(data.country, "E92000001");
	assert.equal(data.centroid.easting, 529700);
	assert.equal(data.point.input.crs, "EPSG:27700");
	assert.equal(data.date, "2026-08");
	assert.equal(data.dateBasis, "directory-edition");
	assert.equal(data.pointCountry.code, "GB-ENG");
	assert.deepEqual(
		data.results.map((result: any) => [
			result.geography,
			result.boundaryRelease,
		]),
		[
			["localAuthority", "2026-05-uk-bgc"],
			["ward", "2026-05-uk-bgc"],
			["constituency", "2024-07-uk-bgc"],
		],
	);
	assert.deepEqual(data.results.map(matched), [
		["localAuthority/2026-05-uk-bgc/E09000001"],
		["ward/2026-05-uk-bgc/E05000001"],
		["constituency/2024-07-uk-bgc/E14000001"],
	]);
	assert.equal(data.results[1].matches[0].nearBoundary, false);
	assert.equal(data.source.edition, "2026-08");
	assert.ok(data.source.attribution.length > 0);
	assert.equal(data.caution, undefined);
	assert.match(data.note, /single centroid/);
});

test("reads the areas the caller names, for the date they give", () => {
	const { data } = get(
		"/v1/postcodes/EC1A%201AB?geography=localAuthority&date=2027-01-01",
	);
	assert.equal(data.status, "terminated");
	assert.equal(data.terminated, "2019-05");
	assert.equal(data.dateBasis, "requested");
	assert.deepEqual(data.results.map(matched), [
		["localAuthority/2026-12-uk-bgc/E09000003"],
	]);
	const pinned = get(
		"/v1/postcodes/EC1A1AB?release=ward/2026-05-uk-bgc",
	).data;
	assert.deepEqual(pinned.results.map(matched), [
		["ward/2026-05-uk-bgc/E05000002"],
	]);
});

test("warns when the directory does not say how accurate a centroid is", () => {
	const { data } = get("/v1/postcodes/EC1A1AD?geography=ward");
	assert.equal(data.centroid.positionalQuality.indicator, 5);
	assert.match(data.caution, /understate/);
});

test("describes a postcode with no grid reference without placing it", () => {
	const { status, data } = get("/v1/postcodes/GY11AA");
	assert.equal(status, 200);
	assert.equal(data.centroid, null);
	assert.equal(data.country, "L93000001");
	assert.deepEqual(data.results, []);
	assert.match(data.detail, /no grid reference/);
});

test("says why a postcode cannot be answered", () => {
	const cases: Array<[string, number, RegExp]> = [
		["/v1/postcodes/Bristol", 400, /not a UK postcode/],
		["/v1/postcodes/EC1A", 400, /postcode district/],
		["/v1/postcodes/EC1A%201", 400, /postcode sector/],
		["/v1/postcodes/EC1A9ZZ", 404, /August 2026/],
		["/v1/postcodes/BT11AA", 451, /Land and Property Services/],
		["/v1/postcodes/EC1A1AA?date=soon", 400, /date must be/],
		["/v1/postcodes/EC1A1AA?geography=nowhere", 404, /./],
	];
	for (const [url, status, detail] of cases) {
		const response = get(url);
		assert.equal(response.status, status, url);
		assert.match(response.body.detail, detail, url);
	}
	assert.equal(
		get("/v1/postcodes/BT11AA").body.detail,
		NORTHERN_IRELAND_EXCLUSION,
	);
});

test("is unavailable until the postcode index is built", () => {
	const response = get("/v1/postcodes/EC1A1AA", context(false));
	assert.equal(response.status, 503);
	assert.match(response.body.detail, /postcode index/);
});

test("looks up a batch of postcodes, reporting each one that cannot be placed", () => {
	const { status, data } = get(
		"/v1/postcodes:batch?postcode=EC1A1AA,ec1a%201ab&postcode=GY11AA&postcode=BT11AA&postcode=EC1A9ZZ&postcode=EC1A&geography=ward",
	);
	assert.equal(status, 200);
	assert.equal(data.date, "2026-08");
	assert.equal(data.dateBasis, "directory-edition");
	assert.deepEqual(
		data.releases.map((release: any) => release.boundaryRelease),
		["2026-05-uk-bgc"],
	);
	assert.deepEqual(
		data.postcodes.map((entry: any) => [entry.input, entry.status]),
		[
			["EC1A1AA", "placed"],
			["ec1a 1ab", "placed"],
			["GY11AA", "not-placed"],
			["BT11AA", "not-served"],
			["EC1A9ZZ", "not-found"],
			["EC1A", "invalid"],
		],
	);
	const [west, east, channel, northernIreland] = data.postcodes;
	assert.equal(west.postcode.postcode, "EC1A 1AA");
	assert.equal(west.pointCountry.code, "GB-ENG");
	assert.deepEqual(west.results.map(matched), [
		["ward/2026-05-uk-bgc/E05000001"],
	]);
	// Provenance is given once, in releases, not repeated per match.
	assert.equal(west.results[0].matches[0].geometrySource, undefined);
	assert.deepEqual(east.results.map(matched), [
		["ward/2026-05-uk-bgc/E05000002"],
	]);
	assert.equal(east.postcode.status, "terminated");
	assert.equal(channel.postcode.country, "L93000001");
	assert.equal(northernIreland.detail, NORTHERN_IRELAND_EXCLUSION);
	assert.deepEqual(data.summary, {
		postcodes: 6,
		placed: 2,
		notPlaced: 1,
		invalid: 1,
		notFound: 1,
		notServed: 1,
		lookups: 2,
		matched: 2,
		noMatch: 0,
		outsideCoverage: 0,
		unresolved: 0,
		nearBoundary: 0,
	});
	assert.equal(data.source.edition, "2026-08");
});

test("places a batch in the default geographies, flagging undeclared accuracy per postcode", () => {
	const { data } = get("/v1/postcodes:batch?postcode=EC1A1AD");
	assert.deepEqual(
		data.releases.map((release: any) => release.geography),
		["localAuthority", "ward", "constituency"],
	);
	assert.match(data.postcodes[0].caution, /understate/);
});

test("refuses a batch it cannot look up", () => {
	const many = Array.from({ length: 101 }, () => "EC1A1AA").join(",");
	const cases: Array<[string, number, RegExp]> = [
		["/v1/postcodes:batch", 400, /at least one postcode/],
		["/v1/postcodes:batch?postcode=,%20", 400, /at least one postcode/],
		[`/v1/postcodes:batch?postcode=${many}`, 400, /At most 100/],
		["/v1/postcodes:batch?postcode=EC1A1AA&date=soon", 400, /date must be/],
	];
	for (const [url, status, detail] of cases) {
		const response = get(url);
		assert.equal(response.status, status, url);
		assert.match(response.body.detail, detail, url);
	}
	assert.equal(
		get("/v1/postcodes:batch?postcode=EC1A1AA", context(false)).status,
		503,
	);
});
