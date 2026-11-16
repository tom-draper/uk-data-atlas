import { createGeographyServices } from "@uk-data-atlas/atlas-loader";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, expect, test } from "vitest";
import { AreaGeometryCache } from "@uk-data-atlas/geometry";
import { createAreaLookup } from "@uk-data-atlas/areas";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import { createGeographyResolver } from "@uk-data-atlas/atlas-loader";
import type { RouteContext } from "../src/runtime/index.ts";
import {
	areaLookup as fixtureAreaLookup,
	crosswalkInventory,
	crosswalkLookup,
	geographyInventory,
	testContext,
} from "./routeFixtures";
import {
	characterize,
	startCharacterization,
	type CharacterizedRequest,
} from "./httpCharacterization";

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
		release("localAuthority", "2025-05-uk-bgc", UK),
		release("constituency", "2024-07-uk-bgc", UK),
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
afterAll(() => rmSync(root, { recursive: true, force: true }));

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
		"data/source",
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
publish("localAuthority", "2025-05-uk-bgc", wards);
publish("constituency", "2024-07-uk-bgc", wards);
publish("localHealthBoard", "2023-12-w-bgc", healthBoards);
publish("country", "2024-12-uk-bgc", countries);

const named = (areas: Array<{ code: string; name: string }>) =>
	areas.map(({ code, name }) => ({ code, name }));
const areaLookup = createAreaLookup([
	identities("ward", "2024-12-uk-bgc", named(wards)),
	identities("ward", "2025-05-uk-bgc", named(wards)),
	identities("localAuthority", "2025-05-uk-bgc", named(wards)),
	identities("constituency", "2024-07-uk-bgc", named(wards)),
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
	areaValidation: createGeographyServices({}).validation,
	postcodes: createGeographyServices({}).postcodes,
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

const json = (value: unknown) => ({
	"content-type": "application/json",
	body: JSON.stringify(value),
});
const post = (
	path: string,
	value: unknown,
	label: string,
	headers: Record<string, string> = {},
): CharacterizedRequest => {
	const { body, ...type } = json(value);
	return {
		path,
		method: "POST",
		body,
		label,
		headers: { ...type, ...headers },
	};
};
const raw = (
	path: string,
	body: string,
	type: string,
	label: string,
): CharacterizedRequest => ({
	path,
	method: "POST",
	body,
	label,
	headers: { "content-type": type },
});

const point = `lng=${0.5 * U}&lat=${0.5 * U}`;
const ward = "release=ward/2024-12-uk-bgc";

test("area lookups keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, lookupContext);
	const requests: CharacterizedRequest[] = [
		...[
			"/v1/areas",
			"/v1/areas?geography=ward",
			"/v1/areas?geography=ward&release=2024-12-uk-bgc",
			"/v1/areas?geography=ward&release=2024-12-uk-bgc&limit=1",
			"/v1/areas?geography=ward&release=2024-12-uk-bgc&limit=1&cursor=bad",
			"/v1/areas?geography=ward&release=latest",
			"/v1/areas?geography=wardd",
			"/v1/areas?geography=ward&limit=0",
			"/v1/areas?geography=ward&unexpected=1",
			"/v1/areas?q=west",
			"/v1/areas:intersects",
			"/v1/areas:intersects?bbox=0,0,0.02,0.02&geography=ward&release=2024-12-uk-bgc",
			"/v1/areas:intersects?bbox=0,0,0.02,0.02&geography=ward&release=2024-12-uk-bgc&limit=1",
			"/v1/areas:intersects?bbox=0,0,0.02,0.02&geography=ward&release=2024-12-uk-bgc&tier=interior",
			"/v1/areas:intersects?bbox=0,0,0.02,0.02&geography=ward&release=2024-12-uk-bgc&tier=nope",
			"/v1/areas:intersects?bbox=0.5,0.5,0.6,0.6&geography=ward&release=2024-12-uk-bgc",
			"/v1/areas:intersects?bbox=2,0,0,2&geography=ward&release=2024-12-uk-bgc",
			"/v1/areas:intersects?bbox=1,2,3&geography=ward&release=2024-12-uk-bgc",
			"/v1/areas:intersects?bbox=0,0,0.02,0.02&geography=ward",
			"/v1/areas:intersects?bbox=0,0,0.02,0.02&geography=region&release=2025-12-en-bgc",
			"/v1/areas:intersects?bbox=0,0,0.02,0.02&geography=ward&release=2024-12-uk-bgc&unexpected=1",
			`/v1/areas:contains?${point}&${ward}`,
			`/v1/areas:contains?${point}`,
			`/v1/areas:contains?${point}&geography=ward`,
			`/v1/areas:contains?${point}&geography=ward,localHealthBoard`,
			`/v1/areas:contains?${point}&geography=ward&geography=localHealthBoard&date=2025-06-15`,
			`/v1/areas:contains?${point}&geography=nowhere&date=2025-01`,
			`/v1/areas:contains?${point}&release=ward/2019-12-uk-bgc`,
			`/v1/areas:contains?${point}&release=region/2025-12-en-bgc`,
			`/v1/areas:contains?${point}&${ward}&accuracy=600`,
			`/v1/areas:contains?lng=${1 * U}&lat=${0.5 * U}&${ward}`,
			`/v1/areas:contains?lng=0&lat=0&${ward}`,
			`/v1/areas:contains?lng=0.5&lat=0.5&${ward}`,
			`/v1/areas:contains?lng=bad&lat=0&${ward}`,
			`/v1/areas:contains?lat=0&${ward}`,
			"/v1/areas:contains",
			`/v1/areas:contains?crs=EPSG:27700&easting=530000&northing=180000&${ward}`,
			`/v1/areas:contains?crs=EPSG:27700&gridref=TQ3000080000&${ward}`,
			`/v1/areas:contains?crs=EPSG:3857&lng=0&lat=0&${ward}`,
			`/v1/areas:contains?${point}&${ward}&unexpected=1`,
			`/v1/areas:near?${point}&${ward}`,
			`/v1/areas:near?${point}&geography=ward`,
			`/v1/areas:near?lng=${2.5 * U}&lat=${0.5 * U}&${ward}&limit=2&within=2000`,
			`/v1/areas:near?lng=0.5&lat=0.5&${ward}&within=50000`,
			`/v1/areas:near?lng=0&lat=0&${ward}&limit=0`,
			`/v1/areas:near?lng=0&lat=0&${ward}&within=-1`,
			`/v1/areas:near?crs=EPSG:27700&easting=530000&northing=180000&${ward}`,
			`/v1/areas:near?${point}&${ward}&unexpected=1`,
			"/v1/areas:near",
		].map((path) => ({ path })),
		...[
			"/v1/areas",
			"/v1/areas:intersects?bbox=0,0,0.02,0.02&geography=ward&release=2024-12-uk-bgc",
			`/v1/areas:contains?${point}&${ward}`,
			`/v1/areas:near?${point}&${ward}`,
		].map((path) => ({ path, method: "HEAD" })),
		{
			path: `/v1/areas:contains?${point}&${ward}`,
			headers: {
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		{
			path: "/v1/areas?geography=ward",
			headers: { "if-none-match": '"unknown"' },
		},
		{ path: "/v1/areas/" },
		{ path: "/v1/Areas" },
		{ path: "/v1/areas:contains/" },
		{ path: "/v1/areas:contains/extra" },
		{ path: "/v1/areas:near/" },
		{ path: "/v1/areas:intersects/extra" },
		{ path: "/v1/areas:other" },
		{ path: "/v1/areas:containsBatch" },
		{ path: "/v1/areas:validate" },
		{ path: "/v1/areas", method: "POST", body: "{}", label: "list" },
		{
			path: "/v1/areas:contains",
			method: "POST",
			body: "{}",
			label: "contains",
		},
		{ path: "/v1/areas:near", method: "PUT" },
		{ path: "/v1/areas:intersects", method: "DELETE" },
		{ path: "/v1/areas:containsBatch", method: "PATCH" },
		...[
			"/v1/areas",
			"/v1/areas:contains",
			"/v1/areas:near",
			"/v1/areas:intersects",
			"/v1/areas:containsBatch",
			"/v1/areas:validate",
		].map((path) => ({
			path,
			method: "OPTIONS",
			headers: {
				origin: "https://example.test",
				"access-control-request-method": "GET",
			},
		})),
		post(
			"/v1/areas:containsBatch?" + ward,
			{ points: ["0.005,0.005", "0.015,0.005", "0,0"] },
			"batch",
		),
		post(
			"/v1/areas:containsBatch?" + ward,
			{ points: ["0.005,0.005,600"] },
			"batch accuracy",
		),
		post(
			"/v1/areas:containsBatch?geography=ward&geography=localHealthBoard&date=2025-01",
			{ points: ["0.005,0.005"] },
			"batch geographies",
		),
		post(
			"/v1/areas:containsBatch?crs=EPSG:27700&" + ward,
			{ points: ["530000,180000", "TQ3000080000"] },
			"batch grid",
		),
		post("/v1/areas:containsBatch?" + ward, { points: [] }, "batch empty"),
		post(
			"/v1/areas:containsBatch?" + ward,
			{ points: Array.from({ length: 101 }, () => "0,0") },
			"batch oversize",
		),
		post(
			"/v1/areas:containsBatch?" + ward,
			{ points: ["bad"] },
			"batch bad point",
		),
		post(
			"/v1/areas:containsBatch?" + ward,
			{ points: "0,0" },
			"batch not array",
		),
		post("/v1/areas:containsBatch?" + ward, {}, "batch no points"),
		post(
			"/v1/areas:containsBatch?" + ward + "&unexpected=1",
			{ points: ["0,0"] },
			"batch unexpected",
		),
		post(
			"/v1/areas:containsBatch",
			{ points: ["0.005,0.005"] },
			"batch no release",
		),
		raw(
			"/v1/areas:containsBatch?" + ward,
			"not json",
			"application/json",
			"batch malformed",
		),
		raw(
			"/v1/areas:containsBatch?" + ward,
			"points",
			"text/plain",
			"batch wrong type",
		),
		raw(
			"/v1/areas:containsBatch?" + ward,
			"",
			"application/json",
			"batch empty body",
		),
		{
			path: "/v1/areas:containsBatch?" + ward,
			method: "POST",
			label: "batch no type",
			body: JSON.stringify({ points: ["0,0"] }),
		},
		post(
			"/v1/areas:containsBatch?" + ward,
			{ points: ["0.005,0.005"] },
			"batch gzip",
			{ "accept-encoding": "gzip" },
		),
		{
			path: "/v1/areas:containsBatch?" + ward,
			method: "HEAD",
			label: "batch head",
		},
		{
			path: "/v1/areas:containsBatch/",
			method: "POST",
			label: "batch slash",
			body: "{}",
			headers: { "content-type": "application/json" },
		},
		{
			path: "/v1/areas:containsBatch?" + ward,
			method: "POST",
			label: "batch large",
			body: "x".repeat(9 * 1024 * 1024),
			headers: { "content-type": "application/json" },
		},
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

const validation = testContext({
	geographyInventory,
	areaLookup: fixtureAreaLookup,
	crosswalkInventory,
	crosswalkLookup,
});

test("area validation keeps its HTTP responses", async (t) => {
	const send = await startCharacterization(t, validation);
	const base = "geography=ward&release=2025-01-en-ward";
	const requests: CharacterizedRequest[] = [
		...[
			"/v1/areas:validate",
			"/v1/areas:validate?value=E05000001",
			"/v1/areas:validate?value=E05000001&value=E05000002",
			"/v1/areas:validate?value=E05000001&value=E08000001",
			"/v1/areas:validate?value=nope",
			"/v1/areas:validate?value=",
			`/v1/areas:validate?${base}`,
			`/v1/areas:validate?${base}&value=E05000001`,
			`/v1/areas:validate?${base}&value=E05000001&value=enghraifft%20ward`,
			`/v1/areas:validate?${base}&value=E05000001&format=csv`,
			`/v1/areas:validate?${base}&value=E05000001&format=ndjson`,
			`/v1/areas:validate?${base}&value=E05000001&format=nope`,
			`/v1/areas:validate?${base}&value=Shared%20ward&parent=North%20council`,
			`/v1/areas:validate?geography=nowhere&value=E05000001`,
			`/v1/areas:validate?geography=ward&release=nowhere&value=E05000001`,
			`/v1/areas:validate?${base}&value=E05000001&unexpected=1`,
			"/v1/areas:validate/",
			"/v1/Areas:validate",
			"/v1/areas:validate/extra",
		].map((path) => ({ path })),
		{ path: `/v1/areas:validate?${base}&value=E05000001`, method: "HEAD" },
		{
			path: `/v1/areas:validate?${base}&value=E05000001`,
			headers: {
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		{
			path: `/v1/areas:validate?${base}&value=E05000001`,
			headers: { "if-none-match": '"unknown"' },
		},
		{
			path: `/v1/areas:validate?${base}&value=E05000001`,
			headers: { accept: "text/csv" },
		},
		post(
			`/v1/areas:validate?${base}`,
			{ values: ["E05000001", "E05000002", "enghraifft ward", "nope"] },
			"values",
		),
		post(
			"/v1/areas:validate",
			{ values: ["E05000001", "E05000002"] },
			"values no release",
		),
		post(
			`/v1/areas:validate?${base}`,
			{ values: ["E05000001"], parents: ["North council"] },
			"values parents",
		),
		post(
			`/v1/areas:validate?${base}`,
			{
				rows: [
					{ area: "E05000001", parent: "North council" },
					{ area: "nope" },
				],
			},
			"rows",
		),
		post(`/v1/areas:validate?${base}`, { values: [] }, "values empty"),
		post(`/v1/areas:validate?${base}`, {}, "values none"),
		post(
			`/v1/areas:validate?${base}`,
			{ values: "E05000001" },
			"values not array",
		),
		post(
			`/v1/areas:validate?${base}&format=csv`,
			{ values: ["E05000001"] },
			"values csv",
		),
		post(
			`/v1/areas:validate?${base}&format=ndjson`,
			{ values: ["E05000001"] },
			"values ndjson",
		),
		post(
			`/v1/areas:validate?${base}&unexpected=1`,
			{ values: ["E05000001"] },
			"values unexpected",
		),
		raw(
			`/v1/areas:validate?${base}`,
			"area\nE05000001\nE05000002\nnope\n",
			"text/csv",
			"csv body",
		),
		raw(`/v1/areas:validate?${base}`, "", "text/csv", "csv empty"),
		raw(
			`/v1/areas:validate?${base}`,
			"not json",
			"application/json",
			"malformed",
		),
		raw(`/v1/areas:validate?${base}`, "values", "text/plain", "wrong type"),
		raw(`/v1/areas:validate?${base}`, "", "application/json", "empty body"),
		post(`/v1/areas:validate?${base}`, { values: ["E05000001"] }, "gzip", {
			"accept-encoding": "gzip",
		}),
		{
			path: `/v1/areas:validate?${base}`,
			method: "POST",
			label: "no type",
			body: JSON.stringify({ values: ["E05000001"] }),
		},
		{
			path: "/v1/areas:validate/",
			method: "POST",
			label: "slash",
			body: "{}",
			headers: { "content-type": "application/json" },
		},
		{
			path: `/v1/areas:validate?${base}`,
			method: "POST",
			label: "large",
			body: "x".repeat(9 * 1024 * 1024),
			headers: { "content-type": "application/json" },
		},
		{ path: `/v1/areas:validate?${base}`, method: "PUT" },
		{ path: `/v1/areas:validate?${base}`, method: "DELETE" },
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("area listing keeps its HTTP responses", async (t) => {
	const send = await startCharacterization(t, validation);
	const requests: CharacterizedRequest[] = [
		...[
			"/v1/areas",
			"/v1/areas?geography=ward",
			"/v1/areas?geography=ward&release=2025-01-en-ward",
			"/v1/areas?geography=ward&release=2025-01-en-ward&limit=1",
			"/v1/areas?geography=ward&release=2025-01-en-ward&limit=1&cursor=bad",
			"/v1/areas?geography=ward&release=2025-01-en-ward&limit=0",
			"/v1/areas?geography=ward&release=latest",
			"/v1/areas?geography=ward&release=1999-01-en-ward",
			"/v1/areas?geography=wardd",
			"/v1/areas?geography=ward&release=2025-01-en-ward&unexpected=1",
			"/v1/areas?q=manchester",
			"/v1/areas/",
		].map((path) => ({ path })),
		{
			path: "/v1/areas?geography=ward&release=2025-01-en-ward",
			method: "HEAD",
		},
		{
			path: "/v1/areas?geography=ward&release=2025-01-en-ward",
			headers: {
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		{
			path: "/v1/areas?geography=ward&release=2025-01-en-ward",
			headers: { "if-none-match": '"unknown"' },
		},
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("area lookups answer without the services they read", async (t) => {
	const bare = testContext({});
	const send = await startCharacterization(t, bare);
	const requests: CharacterizedRequest[] = [
		"/v1/areas?geography=ward",
		"/v1/areas:intersects?bbox=0,0,1,1&geography=ward&release=2024-12-uk-bgc",
		`/v1/areas:contains?${point}&${ward}`,
		`/v1/areas:near?${point}&${ward}`,
		"/v1/areas:validate?value=E05000001",
	].map((path) => ({ path }));
	requests.push(
		post(
			`/v1/areas:containsBatch?${ward}`,
			{ points: ["0,0"] },
			"bare batch",
		),
		post("/v1/areas:validate", { values: ["E05000001"] }, "bare validate"),
	);
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("area lookups answer without geometry", async (t) => {
	const send = await startCharacterization(t, context(false));
	const requests: CharacterizedRequest[] = [
		`/v1/areas:contains?${point}&${ward}`,
		`/v1/areas:near?${point}&${ward}`,
		"/v1/areas:intersects?bbox=0,0,1,1&geography=ward&release=2024-12-uk-bgc",
	].map((path) => ({ path }));
	requests.push(
		post(
			`/v1/areas:containsBatch?${ward}`,
			{ points: ["0,0"] },
			"no geometry batch",
		),
	);
	expect(await characterize(send, requests)).toMatchSnapshot();
});
