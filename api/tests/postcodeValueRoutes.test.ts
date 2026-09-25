import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { AreaGeometryCache } from "../src/areaGeometry";
import { createAreaLookup } from "../src/areaInventory";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import { createGeographyResolver } from "../src/geographyResolver";
import type {
	CompatibilityCandidate,
	MeasureCompatibilityInventory,
} from "../src/measureCompatibility";
import { toWgs84Point } from "../src/reprojection";
import { route } from "../src/routes";
import type { RouteContext } from "../src/routing";
import { postcodeIndexFor, postcodeRow } from "./postcodeFixtures";
import {
	dataCatalog,
	measureObservations,
	populationLocalAuthorityObservations,
	populationObservations,
} from "./routeFixtures";

// Two wards a kilometre or so across either side of a point in London, one
// English authority covering both, and a Scottish authority to the east. The
// population fixture has ward values for E05000001 only, and authority values
// for E06000001 only.
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

const layers = {
	"ward/2023-05-uk-bgc": [
		{ code: "E05000001", name: "West ward", geometry: square(-1, 0) },
		{ code: "E05000002", name: "East ward", geometry: square(0, 1) },
	],
	"localAuthority/2023-05-uk-bgc-v2": [
		{ code: "E06000001", name: "Hartlepool", geometry: square(-1, 1) },
		{ code: "S12000036", name: "Edinburgh", geometry: square(1, 2) },
	],
	"country/2025-12-uk-bgc": [
		{ code: "E92000001", name: "England", geometry: square(-1, 1) },
		{ code: "S92000003", name: "Scotland", geometry: square(1, 2) },
	],
};

const boundaryRegistry: BoundaryRegistry = {
	schemaVersion: 1,
	contentHash: "sha256:registry",
	releases: Object.keys(layers).map((key) => {
		const [geography, id] = key.split("/");
		return {
			id: id!,
			geography: geography!,
			title: key,
			coverage: { countries: ["GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS"] },
			source: {
				publisher: "ONS",
				url: "https://example.com",
				licence: { name: "Open Government Licence" },
			},
			metadataHash: `sha256:${key}`,
		};
	}),
};

const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-postcode-values-"));
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

const candidate = (
	boundaryRelease: string,
	status: CompatibilityCandidate["status"],
): CompatibilityCandidate => ({
	boundaryRelease,
	title: boundaryRelease,
	coverageCountries: ["GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS"],
	status,
	sourceCodeCount: 2,
	candidateCodeCount: 2,
	matchingCodeCount: 2,
	matchedSourceShare: 1,
	unmatchedSourceCodeCount: 0,
	unmatchedSourceCodeSample: [],
	candidateOnlyCodeCount: 0,
	candidateOnlyCodeSample: [],
});

const measureCompatibilityInventory = {
	schemaVersion: 1,
	contentHash: "sha256:compatibility",
	measures: [
		{
			measureId: "population-estimate",
			sources: [
				{
					datasetId: "population",
					sourceGeography: { type: "ward", boundaryYear: 2023 },
					periods: ["2022"],
					candidates: [
						candidate("2023-05-uk-bgc", "code-set-compatible"),
					],
					note: "",
				},
				{
					datasetId: "population-uk",
					sourceGeography: {
						type: "localAuthority",
						boundaryYear: 2023,
					},
					periods: ["2022", "2023", "2024"],
					candidates: [
						candidate("2023-05-uk-bgc-v2", "exact-code-set"),
					],
					note: "",
				},
			],
		},
	],
} as unknown as MeasureCompatibilityInventory;

const { index } = postcodeIndexFor([
	postcodeRow("EC1A 1AA", { east1m: "529700" }),
	postcodeRow("EC1A 1AB", { east1m: "530300" }),
	postcodeRow("EH1 1YZ", { east1m: "532100", ctry: "S92000003" }),
	postcodeRow("GY1 1AA", {
		gridind: "9",
		east1m: "",
		north1m: "",
		ctry: "L93000001",
	}),
]);

const context = (overrides: Partial<RouteContext> = {}): RouteContext => ({
	boundaryRegistry,
	dataCatalog,
	populationObservations,
	populationLocalAuthorityObservations,
	measureObservations,
	measureCompatibilityInventory,
	geographyResolver: createGeographyResolver({
		boundaryRegistry,
		areaLookup,
		areaGeometryCache: new AreaGeometryCache(root, geometrySources, 6),
		postcodeIndex: index,
	}),
	...overrides,
});
const valueContext = context();

const get = (url: string, routeContext = valueContext) => {
	const response = route("GET", url, routeContext);
	return {
		status: response.status,
		body: response.body as Record<string, any>,
		data: (response.body as { data?: any }).data,
	};
};

test("answers for the finest area the data was published for that contains the postcode", () => {
	const { status, data, body } = get(
		"/v1/data/population-estimate/value?postcode=ec1a1aa",
	);
	assert.equal(status, 200, JSON.stringify(body).slice(0, 400));
	assert.deepEqual(data.answer, {
		period: "2022",
		value: 100,
		status: "observed",
		periodDefaulted: true,
		unit: "people",
	});
	assert.equal(data.area.id, "ward/2023-05-uk-bgc/E05000001");
	assert.equal(data.area.boundaryYear, 2023);
	assert.equal(data.area.nearBoundary, false);
	assert.equal(data.method, "postcode-centroid-in-source-area");
	assert.deepEqual(data.boundaryMatch, {
		boundaryRelease: "2023-05-uk-bgc",
		status: "code-set-compatible",
		matchedSourceShare: 1,
	});
	assert.equal(data.postcode.postcode, "EC1A 1AA");
	assert.equal(
		data.via,
		"/v1/data/population-estimate/series?areaCode=E05000001&geography=ward&boundaryYear=2023",
	);
	assert.deepEqual(data.otherGeographies, [
		{
			geography: "localAuthority",
			boundaryYear: 2023,
			ask: "/v1/data/population-estimate/value?postcode=EC1A+1AA&geography=localAuthority",
		},
	]);
	assert.equal(data.passedOver, undefined);
	assert.equal(data.source.edition, "2026-08");
	assert.match(data.note, /2023 boundaries, not today's/);
});

test("falls back to a coarser geography when a finer one has no value there", () => {
	const { status, data } = get(
		"/v1/data/population-estimate/value?postcode=EC1A1AB",
	);
	assert.equal(status, 200);
	assert.equal(data.area.id, "localAuthority/2023-05-uk-bgc-v2/E06000001");
	assert.equal(data.answer.value, 300);
	assert.equal(data.passedOver.length, 1);
	assert.equal(data.passedOver[0].geography, "ward");
	assert.match(data.passedOver[0].reason, /E05000002/);
});

test("reads the geography and period the caller names", () => {
	const { data } = get(
		"/v1/data/population-estimate/value?postcode=EC1A1AA&geography=localAuthority&period=2023",
	);
	assert.equal(data.answer.value, 290);
	assert.equal(data.answer.periodDefaulted, false);
	assert.equal(data.question.geography, "localAuthority");
	// The ward source has no 2023, so there is no other geography to offer.
	assert.deepEqual(data.otherGeographies, []);
});

test("passes over a source that does not cover the postcode's country", () => {
	const { status, body } = get(
		"/v1/data/population-estimate/value?postcode=EH11YZ",
	);
	assert.equal(status, 422);
	assert.deepEqual(
		body.candidates.map((entry: any) => entry.geography),
		["ward", "localAuthority"],
	);
	assert.match(body.candidates[0].reason, /GB-SCT/);
	assert.match(body.candidates[1].reason, /S12000036/);
});

test("says why a postcode's value cannot be answered", () => {
	const cases: Array<[string, number, RegExp]> = [
		[
			"/v1/data/population-estimate/value?postcode=EC1A1AA&place=Hartlepool",
			400,
			/not both/,
		],
		["/v1/data/population-estimate/value?postcode=EC1A", 400, /district/],
		["/v1/data/population-estimate/value?postcode=EC1A9ZZ", 404, /./],
		[
			"/v1/data/population-estimate/value?postcode=GY11AA",
			422,
			/no grid reference/,
		],
		[
			"/v1/data/population-estimate/value?postcode=EC1A1AA&geography=msoa",
			422,
			/not published for msoa/,
		],
		[
			"/v1/data/population-estimate/value?postcode=EC1A1AA&period=1999",
			422,
			/no source for 1999/,
		],
		[
			"/v1/data/population-estimate/value?postcode=EC1A1AA&boundaryYear=23",
			400,
			/four-digit/,
		],
	];
	for (const [url, status, detail] of cases) {
		const response = get(url);
		assert.equal(response.status, status, url);
		assert.match(response.body.detail, detail, url);
	}
	const withoutCompatibility = get(
		"/v1/data/population-estimate/value?postcode=EC1A1AA",
		context({ measureCompatibilityInventory: undefined }),
	);
	assert.equal(withoutCompatibility.status, 503);
});
