import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";
import { afterAll, expect, test } from "vitest";
import type { PopulationObservation } from "@uk-data-atlas/catalogue/node";
import type { MapResourceDescriptor } from "@uk-data-atlas/geometry/tiles";
import { TOPOLOGY_METHOD } from "@uk-data-atlas/geometry/tiles";
import {
	measureSeriesSourceKey,
	registerSeriesObservations,
} from "@uk-data-atlas/measures";
import {
	compatibleWardAreaLookup,
	dataCatalog,
	measureCompatibilityInventory,
	populationObservations,
	testContext,
} from "./routeFixtures";
import {
	characterize,
	startCharacterization,
	type CharacterizedRequest,
} from "./httpCharacterization";
import type { RouteContext } from "../src/runtime/index.ts";

const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-map-resources-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

// Stored files whose bytes are known, so a range can be told apart by content.
const archiveBytes = Buffer.from("PMTiles archive: 0123456789abcdefghijklmnop");
const parquetBytes = Buffer.from("PAR1 full detail wards 0123456789 PAR1");
const geojsonBytes = Buffer.from('{"type":"FeatureCollection","features":[]}');
const archivePath = join(root, "ward.pmtiles");
const parquetPath = join(root, "ward-full.parquet");
const geojsonPath = join(root, "ward-low.geojson");
writeFileSync(archivePath, archiveBytes);
writeFileSync(parquetPath, parquetBytes);
writeFileSync(geojsonPath, geojsonBytes);

// The gzip header's OS byte differs by platform; pin it so the snapshot's
// ETag is the same on macOS and Linux.
const tile = gzipSync(Buffer.from("vector tile 1/0/0"));
tile[9] = 3;

const attribution = {
	text: "Fixture",
	publisher: "Fixture",
	sourceUrl: "https://example.com",
	licence: { name: "Fixture" },
	href: "/v1/attribution",
};
const resource = (
	boundaryRelease: string,
	features: unknown[],
): MapResourceDescriptor =>
	({
		id: `ward/${boundaryRelease}`,
		geography: "ward",
		boundaryRelease,
		title: `Fixture wards ${boundaryRelease}`,
		topology: "shared-arc",
		areaCount: 3,
		arcCount: 0,
		bounds: [-1, 50, 1, 54],
		tiles: {
			artifact: "fixture.pmtiles",
			href: `/v1/map-resources/ward/${boundaryRelease}.pmtiles`,
			format: "pmtiles-3",
			tileFormat: "mvt-2.1",
			layer: "areas",
			minZoom: 0,
			maxZoom: 2,
			zooms: [],
			tileCount: 1,
			bytes: archiveBytes.length,
			contentHash: "sha256:fixture",
		},
		tiers: [],
		features,
		generalisation: TOPOLOGY_METHOD,
		geometrySource: {},
		attribution,
	}) as never;

const feature = (
	tier: string,
	format: string,
	extra: Record<string, unknown> = {},
) => ({
	tier,
	format,
	contentHash: `sha256:${tier}-${format}`,
	bytes: 10,
	href: `/v1/map-resources/ward/2023-05-uk-bgc/features?tier=${tier}${format === "geojson" ? "&format=geojson" : ""}`,
	...extra,
});

const withFiles = resource("2023-05-uk-bgc", [
	feature("full", "geoparquet-1.1", { artifact: "features/full.parquet" }),
	feature("low", "geoparquet-1.1"),
	feature("low", "geojson", { artifact: "features/low.geojson" }),
	feature("medium", "geojson"),
]);
const archived = {
	bytes: archiveBytes.length,
	minZoom: 0,
	maxZoom: 2,
	path: archivePath,
	tile: (z: number, x: number, y: number) =>
		z === 1 && x === 0 && y === 0 ? tile : undefined,
};
const stored = (path: string, content: Buffer) => ({
	path,
	bytes: content.length,
	contentHash: "sha256:stored",
});

const records: PopulationObservation[] = [
	{ areaCode: "E05000001", value: 5, status: "observed" },
	{ areaCode: "W05000001", value: 9, status: "observed" },
];
const context = (overrides: Partial<RouteContext> = {}): RouteContext => {
	const artifact = {
		...populationObservations,
		periods: [{ period: "2022", records }],
	};
	const artifacts = [artifact];
	const source = dataCatalog.measures
		.find((measure) => measure.id === "population")!
		.sources.find((entry) => entry.datasetId === "population")!;
	registerSeriesObservations(
		artifacts,
		new Map([
			[
				measureSeriesSourceKey({ measure: "population" }, source),
				artifact,
			],
		]),
	);
	return testContext({
		areaLookup: compatibleWardAreaLookup,
		dataCatalog,
		measureCompatibilityInventory,
		measureObservations: artifacts,
		mapResources: {
			resources: [
				withFiles,
				resource("2024-05-tiled", [feature("full", "geoparquet-1.1")]),
			],
			unavailable: [
				{
					geography: "ward",
					boundaryRelease: "2022-05-untiled",
					reason: "ward/2022-05-untiled is not a coverage.",
					features: [
						feature("full", "geoparquet-1.1", {
							href: "/v1/map-resources/ward/2022-05-untiled/features?tier=full",
						}),
					] as never,
				},
			],
		},
		mapArchives: new Map([["ward/2023-05-uk-bgc", archived]]),
		mapFeatures: new Map([
			["features/full.parquet", stored(parquetPath, parquetBytes)],
			["features/low.geojson", stored(geojsonPath, geojsonBytes)],
		]),
		fullDetailDownloads: {
			get: (
				_geography: string,
				release: string,
				_topology: string,
				hash?: string,
			) =>
				release === "2023-05-uk-bgc" &&
				hash === "sha256:low-geoparquet-1.1"
					? { status: "built", body: Buffer.from("PAR1 built PAR1") }
					: hash === "sha256:medium-geojson"
						? { status: "stale" }
						: { status: "missing" },
			build: async () => ({
				status: "built",
				body: Buffer.from("PAR1 built PAR1"),
			}),
		} as never,
		...overrides,
	});
};

// The harness keys a response by method, path and label, so requests that
// differ only in their headers are told apart by them.
const labelled = (requests: CharacterizedRequest[]) =>
	requests.map((request) => ({
		...request,
		label:
			request.label ??
			(request.headers ? JSON.stringify(request.headers) : undefined),
	}));

const base = "/v1/map-resources/ward/2023-05-uk-bgc";
const join_ = `${base}/join/population?period=2022&geography=ward&codeYear=2023`;

test("serves a range of a generated download after caching the full response", async (t) => {
	const send = await startCharacterization(t, context(), {
		responseCacheBytes: 1024 * 1024,
	});
	const path = `${base}/features?tier=low`;
	const whole = await send({ path });
	expect(whole.status).toBe(200);
	expect(whole.body).toBe("PAR1 built PAR1");
	const partial = await send({ path, headers: { range: "bytes=5-9" } });
	expect(partial.status).toBe(206);
	expect(partial.headers).toContain("content-range: bytes 5-9/15");
	expect(partial.body).toBe("built");
	expect(await send({ path })).toEqual(whole);
});

test("map resources keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, context());
	const requests: CharacterizedRequest[] = [
		...[
			"/v1/map-resources",
			"/v1/map-resources/",
			"/v1/map-resources?unexpected=1",
			base,
			`${base}?unexpected=1`,
			`${base}/`,
			"/v1/map-resources/ward/2024-05-tiled",
			"/v1/map-resources/ward/2022-05-untiled",
			"/v1/map-resources/ward/nowhere",
			"/v1/map-resources/nowhere/2023-05-uk-bgc",
			"/v1/Map-Resources/ward/2023-05-uk-bgc",
			"/v1/map-resources/ward",
			`${base}/other`,
			`${base}/tiles.json`,
			`${base}/tiles.json?unexpected=1`,
			"/v1/map-resources/ward/nowhere/tiles.json",
			`${base}/tiles.json/`,
			`${base}/features`,
			`${base}/features?tier=full`,
			`${base}/features?tier=full&format=geoparquet`,
			`${base}/features?tier=low`,
			`${base}/features?tier=low&format=geojson`,
			`${base}/features?tier=medium&format=geojson`,
			`${base}/features?tier=medium`,
			`${base}/features?tier=full&format=geojson`,
			`${base}/features?tier=nope`,
			`${base}/features?tier=full&format=nope`,
			`${base}/features?tier=full&unexpected=1`,
			"/v1/map-resources/ward/2022-05-untiled/features?tier=full",
			"/v1/map-resources/ward/2022-05-untiled/features?tier=low",
			"/v1/map-resources/ward/2022-05-untiled/tiles.json",
			"/v1/map-resources/ward/nowhere/features?tier=full",
			`${base}/features/`,
			`${base}/tiles/1/0/0.mvt`,
			`${base}/tiles/0/0/0.mvt`,
			`${base}/tiles/2/3/3.mvt`,
			`${base}/tiles/3/0/0.mvt`,
			`${base}/tiles/a/0/0.mvt`,
			`${base}/tiles/1/0/x.mvt`,
			`${base}/tiles/1/-1/0.mvt`,
			`${base}/tiles/1/0/0.png`,
			`${base}/tiles/1/0/0`,
			`${base}/tiles/1/0/0.mvt/`,
			`${base}/tiles/1/0/.mvt`,
			`${base}/tiles/1/0/0.mvt?unexpected=1`,
			`${base}/tiles/1/0`,
			`${base}/tiles/1/0/0/0.mvt`,
			"/v1/map-resources/ward/nowhere/tiles/1/0/0.mvt",
			"/v1/map-resources/ward/2024-05-tiled/tiles/1/0/0.mvt",
			join_,
			`${join_}&format=json`,
			`${join_}&format=parquet`,
			`${join_}&format=nope`,
			`${join_}&unexpected=1`,
			`${base}/join/population`,
			`${base}/join/population?period=2022`,
			`${base}/join/population?period=1900&geography=ward&codeYear=2023`,
			`${base}/join/nothing?period=2022&geography=ward&codeYear=2023`,
			`${base}/join/population/`,
			`${base}/join/`,
			"/v1/map-resources/ward/nowhere/join/population?period=2022",
			`${base}.pmtiles`,
			`${base}.pmtiles?unexpected=1`,
			`${base}.pmtiles/`,
			"/v1/map-resources/ward/.pmtiles",
			"/v1/map-resources/ward/nowhere.pmtiles",
			"/v1/map-resources/ward/2024-05-tiled.pmtiles",
			"/v1/map-resources/ward/2022-05-untiled.pmtiles",
			`${base}.pmtiles.pmtiles`,
			`${base}.PMTILES`,
		].map((path) => ({ path })),
		...[
			base,
			`${base}.pmtiles`,
			`${base}/tiles.json`,
			`${base}/features?tier=full`,
			`${base}/features?tier=low`,
			`${base}/features?tier=low&format=geojson`,
			`${base}/tiles/1/0/0.mvt`,
			`${base}/tiles/0/0/0.mvt`,
			join_,
			`${join_}&format=parquet`,
		].map((path) => ({ path, method: "HEAD" })),
		...[
			`${base}.pmtiles`,
			`${base}/features?tier=full`,
			`${base}/features?tier=low&format=geojson`,
			`${base}/tiles/1/0/0.mvt`,
			`${join_}&format=parquet`,
		].flatMap((path) => [
			{ path, headers: { range: "bytes=0-9" } },
			{ path, headers: { range: "bytes=5-" } },
			{ path, headers: { range: "bytes=-5" } },
			{ path, headers: { range: "bytes=0-0" } },
			{ path, headers: { range: "bytes=2-2000" } },
			{ path, headers: { range: "bytes=900-1000" } },
			{ path, headers: { range: "bytes=9-3" } },
			{ path, headers: { range: "bytes=0-1,3-4" } },
			{ path, headers: { range: "bytes=abc" } },
			{ path, headers: { range: "items=0-1" } },
			{
				path,
				headers: { range: "bytes=0-9", "accept-encoding": "gzip" },
			},
			{ path, method: "HEAD", headers: { range: "bytes=0-9" } },
			{ path, headers: { "accept-encoding": "gzip" } },
			{ path, headers: { "accept-encoding": "identity" } },
			{ path, headers: { "if-none-match": '"unknown"' } },
			{ path, headers: { "if-none-match": "*" } },
			{ path, headers: { "if-range": '"unknown"', range: "bytes=0-3" } },
			{ path, headers: { origin: "https://example.test" } },
		]),
		...[
			"/v1/map-resources",
			base,
			`${base}.pmtiles`,
			`${base}/tiles.json`,
			`${base}/features`,
			`${base}/tiles/1/0/0.mvt`,
			`${base}/join/population`,
		].flatMap((path) => [
			{ path, method: "POST", body: "{}", label: "post" },
			{ path, method: "PUT" },
			{ path, method: "DELETE" },
			{ path, method: "PATCH" },
			{
				path,
				method: "OPTIONS",
				headers: {
					origin: "https://example.test",
					"access-control-request-method": "GET",
				},
			},
		]),
	];
	expect(await characterize(send, labelled(requests))).toMatchSnapshot();
});

test("map resources behind a CDN keep their HTTP responses", async (t) => {
	const mapResources = (extra: Record<string, string>) => ({
		...context().mapResources!,
		...extra,
	});
	const requests: CharacterizedRequest[] = [
		base,
		`${base}.pmtiles`,
		`${base}/tiles.json`,
		`${base}/features?tier=full`,
		`${base}/features?tier=low`,
		`${base}/features?tier=low&format=geojson`,
		`${base}/tiles/1/0/0.mvt`,
		`${base}/tiles/3/0/0.mvt`,
		join_,
	].map((path) => ({ path }));
	for (const [name, extra] of [
		["tiles", { tileBaseUrl: "https://tiles.example.com" }],
		["assets", { assetBaseUrl: "https://maps.example.com" }],
		[
			"both",
			{
				tileBaseUrl: "https://tiles.example.com",
				assetBaseUrl: "https://maps.example.com",
			},
		],
	] as const) {
		const send = await startCharacterization(
			t,
			context({ mapResources: mapResources(extra) }),
		);
		const answers = await characterize(send, requests);
		expect({ [name]: answers }).toMatchSnapshot(name);
	}
});

test("map resources without their files or catalogue keep their HTTP responses", async (t) => {
	const requests: CharacterizedRequest[] = [
		"/v1/map-resources",
		base,
		`${base}.pmtiles`,
		`${base}/tiles.json`,
		`${base}/features?tier=full`,
		`${base}/features?tier=low`,
		`${base}/tiles/1/0/0.mvt`,
		join_,
		`${base}/other`,
		`${base}/tiles/1/0/0.png`,
	].map((path) => ({ path }));
	for (const [name, overrides] of [
		["no resources", { mapResources: undefined }],
		["no archives", { mapArchives: undefined, mapFeatures: undefined }],
		["no downloads", { fullDetailDownloads: undefined }],
	] as const) {
		const send = await startCharacterization(
			t,
			context(overrides as Partial<RouteContext>),
		);
		expect({ [name]: await characterize(send, requests) }).toMatchSnapshot(
			name,
		);
	}
});
