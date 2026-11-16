import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, expect, test } from "vitest";
import { AreaGeometryCache } from "@uk-data-atlas/geometry";
import {
	areaLookup,
	crosswalkInventory,
	crosswalkLookup,
	geographyInventory,
	registry,
	testContext,
} from "./routeFixtures";
import {
	characterize,
	startCharacterization,
	type CharacterizedRequest,
} from "./httpCharacterization";

const square = (west: number, south: number, east: number, north: number) => ({
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

const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-area-detail-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const write = (
	path: string,
	codeProperty: string,
	features: Array<[string, unknown]>,
) => {
	mkdirSync(join(root, "data/source", path, ".."), { recursive: true });
	writeFileSync(
		join(root, "data/source", path),
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
	["E05000001", square(-1, 54, 0, 55)],
	["E05000002", square(0, 54, 1, 55)],
	["E05000003", square(0, 55, 1, 56)],
]);
write("boundaries/local-authority/2025-01-uk-lad/lad.geojson", "LAD25CD", [
	["E08000001", square(-1, 54, 1, 55)],
]);

const boundaryRegistry = {
	...registry,
	releases: [
		...registry.releases,
		{
			...registry.releases[0]!,
			id: "2025-01-uk-lad",
			geography: "localAuthority",
			title: "Local authority boundaries",
		},
	],
};

const withGeometry = testContext(
	{
		boundaryRegistry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	},
	new AreaGeometryCache(
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
);
const withoutGeometry = testContext({
	boundaryRegistry,
	geographyInventory,
	areaLookup,
	crosswalkInventory,
	crosswalkLookup,
});

const ward = "/v1/areas/ward/2025-01-en-ward/E05000001";
const authority = "/v1/areas/localAuthority/2025-01-uk-lad/E08000001";

const suffixes = [
	"",
	"/relationships",
	"/history",
	"/parents",
	"/children",
	"/children/geometry",
	"/neighbours",
	"/overlap",
	"/geometry",
];

test("area detail routes keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, withGeometry);
	const requests: CharacterizedRequest[] = [
		...[
			ward,
			`${ward}?unexpected=1`,
			`${ward}?measure=population`,
			`${ward}?crosswalk=ward-to-local-authority-2025`,
			"/v1/areas/wd/2025-01-en-ward/E05000001",
			"/v1/areas/ward/2025-01-en-ward/e05000001",
			"/v1/areas/ward/2025-01-en-ward/E05099999",
			"/v1/areas/ward/2025-01-en-ward/E05000001%20",
			"/v1/areas/ward/nowhere/E05000001",
			"/v1/areas/nowhere/2025-01-en-ward/E05000001",
			"/v1/areas/ward/2025-01-en-ward/E05000001/",
			"/v1/areas/ward/2025-01-en-ward/E05000001/other",
			"/v1/areas/ward/2025-01-en-ward/E05000001/children/other",
			"/v1/areas/ward/2025-01-en-ward/E05000001/geometry/extra",
			"/v1/areas/ward/2025-01-en-ward/E05000001/similar",
			"/v1/areas/ward/2025-01-en-ward",
			"/v1/areas/ward",
			"/v1/areas/ward/2025-01-en-ward/E05000001/a/b/c",
			`${ward}/relationships`,
			`${ward}/relationships?depth=2`,
			`${ward}/relationships?depth=0`,
			`${ward}/relationships?unexpected=1`,
			`${authority}/relationships`,
			`${ward}/parents`,
			`${ward}/parents?depth=2`,
			`${ward}/parents?depth=x`,
			`${ward}/parents?depth=99`,
			`${ward}/parents?unexpected=1`,
			`${authority}/children`,
			`${authority}/children?depth=2`,
			`${authority}/children?childGeography=ward`,
			`${authority}/children?childGeography=ward/2025-01-en-ward`,
			`${authority}/children?childGeography=a/b/c`,
			`${authority}/children?unexpected=1`,
			`${ward}/history`,
			`${ward}/history?depth=2`,
			`${ward}/history?depth=x`,
			`${ward}/history?unexpected=1`,
			`${authority}/history`,
			`${authority}/children/geometry`,
			`${authority}/children/geometry?tier=low`,
			`${authority}/children/geometry?tier=nope`,
			`${authority}/children/geometry?childGeography=ward`,
			`${authority}/children/geometry?childGeography=ward/2025-01-en-ward`,
			`${authority}/children/geometry?childGeography=a/b/c`,
			`${authority}/children/geometry?unexpected=1`,
			`${ward}/children/geometry`,
			`${ward}/overlap?place=`,
			`${ward}/overlap?place=ward/2025-01-en-ward/E05000001`,
			`${ward}/neighbours`,
			`${ward}/neighbours?touches=edge`,
			`${ward}/neighbours?touches=any`,
			`${ward}/neighbours?touches=nope`,
			`${ward}/neighbours?unexpected=1`,
			"/v1/areas/ward/2025-01-en-ward/E05099999/neighbours",
			`${ward}/overlap`,
			`${ward}/overlap?place=localAuthority/2025-01-uk-lad/E08000001`,
			`${ward}/overlap?place=ward/2025-01-en-ward/E05000002`,
			`${ward}/overlap?place=ward/2025-01-en-ward/E05099999`,
			`${ward}/overlap?place=nope`,
			`${ward}/overlap?place=a/b/c/d`,
			`${ward}/overlap?place=localAuthority/2025-01-uk-lad/E08000001&unexpected=1`,
			`${ward}/geometry`,
			`${ward}/geometry?tier=low`,
			`${ward}/geometry?tier=full`,
			`${ward}/geometry?tier=nope`,
			`${ward}/geometry?unexpected=1`,
			"/v1/areas/ward/2025-01-en-ward/E05099999/geometry",
			"/v1/areas/ward/2025-01-en-ward/E05099999/relationships",
			"/v1/areas/ward/2025-01-en-ward/E05099999/history",
			"/v1/areas/ward/2025-01-en-ward/E05099999/parents",
			"/v1/areas/ward/2025-01-en-ward/E05099999/children",
			"/v1/areas/ward/2025-01-en-ward/E05099999/children/geometry",
			"/v1/areas/ward/2025-01-en-ward/E05099999/overlap",
			"/v1/areas/ward/nowhere/E05000001/geometry",
			"/v1/areas/nowhere/2025-01-en-ward/E05000001/relationships",
			`${authority}`,
			`${authority}/geometry`,
		].map((path) => ({ path })),
		...suffixes.map((suffix) => ({
			path: `${ward}${suffix}`,
			method: "HEAD",
		})),
		...suffixes.map((suffix) => ({
			path: `${ward}${suffix}`,
			headers: {
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		})),
		...suffixes.map((suffix) => ({
			path: `${ward}${suffix}`,
			headers: { "if-none-match": '"unknown"' },
		})),
		...suffixes.map((suffix) => ({
			path: `${ward}${suffix}`,
			method: "POST",
			body: "{}",
			label: "post",
		})),
		...suffixes.map((suffix) => ({
			path: `${ward}${suffix}`,
			method: "PUT",
		})),
		...suffixes.map((suffix) => ({
			path: `${ward}${suffix}`,
			method: "DELETE",
		})),
		...suffixes.map((suffix) => ({
			path: `${ward}${suffix}`,
			method: "OPTIONS",
			headers: {
				origin: "https://example.test",
				"access-control-request-method": "GET",
			},
		})),
		{ path: `${ward}/geometry`, headers: { accept: "application/json" } },
		{
			path: `${ward}/geometry`,
			headers: { accept: "application/geo+json" },
		},
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("area detail routes without geometry keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, withoutGeometry);
	const requests: CharacterizedRequest[] = [
		...[
			ward,
			`${ward}/relationships`,
			`${ward}/history`,
			`${authority}/children`,
			`${authority}/children/geometry`,
			`${ward}/neighbours`,
			`${ward}/overlap?place=localAuthority/2025-01-uk-lad/E08000001`,
			`${ward}/geometry`,
			`${ward}/geometry?tier=nope`,
		].map((path) => ({ path })),
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});
