import { expect, test } from "vitest";
import {
	createRemoteTerrainProvider,
	createSyntheticTerrainProvider,
} from "@uk-data-atlas/geometry/terrain";
import {
	characterize,
	startCharacterization,
	type CharacterizedRequest,
} from "./httpCharacterization";
import { createTerrainCatalogue } from "./pipelineFixtures";
import { testContext } from "./routeFixtures";

const source = {
	id: "ea-lidar-composite-dtm-2m",
	version: "remote-preview",
	provenance: "remote-preview" as const,
	crs: "EPSG:27700" as const,
	horizontalDatum: "OSGB36" as const,
	horizontalTransformation: "OSTN15" as const,
	verticalDatum: "ODN" as const,
	verticalModel: "OSGM15" as const,
	resolutionMetres: 2,
	noData: -3.4028235e38,
	uncertainty: { metric: "rmse" as const, valueMetres: 0.15 },
	coverage: {
		kind: "bbox" as const,
		bbox: [80000, 4000, 658081.8635, 666000] as [
			number,
			number,
			number,
			number,
		],
		footprintHash: "fixture-footprint",
	},
};
const remote = (fetcher: typeof fetch) =>
	createRemoteTerrainProvider({
		endpoint: "https://example.test/ImageServer/getSamples",
		source,
		fetcher,
	});

const catalogue = testContext({ terrainCatalogue: createTerrainCatalogue() });
const synthetic = testContext({
	terrainCatalogue: createTerrainCatalogue(),
	terrainProvider: createSyntheticTerrainProvider(),
});
const sampled = testContext({
	terrainAsyncProvider: remote(
		async () =>
			new Response(JSON.stringify({ samples: [{ value: 123.4 }] })),
	),
});
const failing = testContext({
	terrainAsyncProvider: remote(async () => {
		throw new Error("upstream unavailable");
	}),
});
const bare = testContext();

const methods = (path: string): CharacterizedRequest[] => [
	{
		path,
		method: "OPTIONS",
		headers: {
			origin: "https://example.test",
			"access-control-request-method": "GET",
		},
	},
	...["POST", "PUT", "PATCH", "DELETE"].map((method) => ({ path, method })),
];

const point = "/v1/terrain/elevation/point";
const pointPaths = [
	point,
	`${point}?x=115&y=215`,
	`${point}?x=115&y=215&interpolation=bilinear`,
	`${point}?x=115&y=215&interpolation=nearest`,
	`${point}?x=115&y=215&interpolation=cubic`,
	`${point}?x=115&y=215&interpolation=`,
	`${point}?x=99&y=215`,
	`${point}?x=115`,
	`${point}?y=215`,
	`${point}?x=abc&y=215`,
	`${point}?x=&y=`,
	`${point}?x=Infinity&y=215`,
	`${point}?x=115&y=215&version=missing`,
	`${point}?x=115&y=215&version=remote-preview`,
	`${point}?x=115&x=116&y=215`,
	`${point}?x=115&y=215&unexpected=1`,
	`${point}/`,
	`${point}/extra`,
	"/v1/terrain/Elevation/point",
	"/v1/terrain/elevation",
	"/v1/terrain/elevation/",
	"/v1/terrain/elevation/%70oint?x=115&y=215",
];
const catalogueRequests: CharacterizedRequest[] = [
	...[
		"/v1/terrain",
		"/v1/terrain/",
		"/v1/terrain?unexpected=1",
		"/v1/terrain/terrain-contours",
		"/v1/terrain/terrain-elevation?unexpected=1",
		"/v1/terrain/contours",
		"/v1/terrain/Terrain-Contours",
		"/v1/terrain/terrain-contours/",
		"/v1/terrain/terrain-contours/extra",
		"/v1/terrain/%74errain-contours",
		"/v1/terrain/a%2Fb",
		"/v1/terrain/.",
		"/v1/terrain/..",
		"/v1/terrain/%E0%A4%A",
		`/v1/terrain/${"x".repeat(150)}`,
		"/v1/Terrain",
	].map((path) => ({ path })),
	{ path: "/v1/terrain", method: "HEAD" },
	{ path: "/v1/terrain/terrain-contours", method: "HEAD" },
	{ path: "/v1/terrain/missing", method: "HEAD" },
	{ path: "/v1/terrain", headers: { origin: "https://example.test" } },
	{ path: "/v1/terrain", headers: { "accept-encoding": "gzip" } },
	...methods("/v1/terrain"),
	...methods("/v1/terrain/terrain-contours"),
	...methods("/v1/terrain/missing"),
	...methods(point),
];

test("terrain discovery keeps its HTTP responses", async (t) => {
	const send = await startCharacterization(t, catalogue);
	const first = await send({ path: "/v1/terrain" });
	const etag =
		first.headers.find((line) => line.startsWith("etag: "))?.slice(6) ?? "";
	expect(
		await characterize(send, [
			...catalogueRequests,
			{ path: "/v1/terrain", headers: { "if-none-match": etag } },
		]),
	).toMatchSnapshot();
});

test("terrain discovery keeps its refusal without a catalogue", async (t) => {
	const send = await startCharacterization(t, bare);
	expect(
		await characterize(send, [
			{ path: "/v1/terrain" },
			{ path: "/v1/terrain/terrain-contours" },
			{ path: point },
			{ path: `${point}?x=115&y=215` },
		]),
	).toMatchSnapshot();
});

test("terrain points keep their HTTP responses with a local provider", async (t) => {
	const send = await startCharacterization(t, synthetic);
	expect(
		await characterize(send, [
			...pointPaths.map((path) => ({ path })),
			{ path: `${point}?x=115&y=215`, method: "HEAD" },
		]),
	).toMatchSnapshot();
});

test("terrain points keep their HTTP responses with a remote provider", async (t) => {
	const send = await startCharacterization(t, sampled);
	expect(
		await characterize(send, [
			...pointPaths.map((path) => ({ path })),
			{ path: `${point}?x=115&y=215`, method: "HEAD" },
			{
				path: `${point}?x=115&y=215`,
				headers: { "accept-encoding": "gzip" },
			},
		]),
	).toMatchSnapshot();
});

test("terrain points keep their refusal when the remote provider fails", async (t) => {
	const send = await startCharacterization(t, failing);
	expect(
		await characterize(send, [
			{ path: `${point}?x=115&y=215` },
			{ path: `${point}?x=abc&y=215` },
		]),
	).toMatchSnapshot();
});
