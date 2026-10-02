import assert from "node:assert/strict";
import test from "node:test";
import { route as routeRequest, routeAsync } from "../src/routes";
import { createTerrainCatalogue } from "../src/terrainCatalogue";
import { testContext } from "./routeFixtures";
import {
	createRemoteTerrainProvider,
	createSyntheticTerrainProvider,
	validateTerrainRaster,
} from "../src/terrainProvider";

test("terrain catalogue is explicit about planned rather than served products", () => {
	const response = routeRequest(
		"GET",
		"/v1/terrain",
		testContext({ terrainCatalogue: createTerrainCatalogue() }),
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body
			? (
					response.body.data as {
						products: Array<{
							id: string;
							availability: { status: string };
						}>;
					}
				).products.map((product) => [
					product.id,
					product.availability.status,
				])
			: [],
		[
			["terrain-elevation", "not-published"],
			["surface-elevation", "not-published"],
			["terrain-slope", "not-published"],
			["terrain-aspect", "not-published"],
			["terrain-contours", "not-published"],
			["terrain-hillshade", "not-published"],
		],
	);
});

test("terrain product lookup neither guesses an id nor claims a missing catalogue", () => {
	const catalogue = testContext({
		terrainCatalogue: createTerrainCatalogue(),
	});
	const product = routeRequest(
		"GET",
		"/v1/terrain/terrain-contours",
		catalogue,
	);
	assert.equal(product.status, 200);
	assert.equal(
		"data" in product.body
			? (product.body.data as { kind: string }).kind
			: undefined,
		"vector",
	);
	assert.equal(
		routeRequest("GET", "/v1/terrain/contours", catalogue).status,
		404,
	);
	assert.equal(routeRequest("GET", "/v1/terrain", testContext()).status, 503);
});

test("terrain point returns a versioned interpolated value", () => {
	const response = routeRequest(
		"GET",
		"/v1/terrain/elevation/point?x=115&y=215&interpolation=bilinear",
		testContext({
			terrainCatalogue: createTerrainCatalogue(),
			terrainProvider: createSyntheticTerrainProvider(),
		}),
	);
	assert.equal(response.status, 200);
	assert.equal(
		"data" in response.body
			? (response.body.data as { status: string }).status
			: undefined,
		"ok",
	);
	assert.equal(
		"data" in response.body
			? (response.body.data as { value: number }).value
			: undefined,
		30,
	);
	assert.equal(
		"data" in response.body
			? (
					response.body.data as {
						source: {
							crs: string;
							verticalDatum: string;
							contentHash: string;
						};
					}
				).source.crs
			: undefined,
		"EPSG:27700",
	);
});

test("terrain point reports outside coverage explicitly", () => {
	const response = routeRequest(
		"GET",
		"/v1/terrain/elevation/point?x=99&y=215",
		testContext({ terrainProvider: createSyntheticTerrainProvider() }),
	);
	assert.equal(response.status, 200);
	assert.equal(
		"data" in response.body
			? (response.body.data as { status: string }).status
			: undefined,
		"outside_coverage",
	);
});

test("terrain point supports nearest interpolation and explicit nodata", () => {
	const nearest = routeRequest(
		"GET",
		"/v1/terrain/elevation/point?x=115&y=215&interpolation=nearest",
		testContext({ terrainProvider: createSyntheticTerrainProvider() }),
	);
	assert.equal(nearest.status, 200);
	assert.equal(
		"data" in nearest.body
			? (nearest.body.data as { value: number }).value
			: undefined,
		30,
	);

	const nodata = routeRequest(
		"GET",
		"/v1/terrain/elevation/point?x=115&y=215&interpolation=nearest",
		testContext({
			terrainProvider: createSyntheticTerrainProvider([
				10,
				20,
				30,
				20,
				null,
				40,
				30,
				40,
				50,
			]),
		}),
	);
	assert.equal(nodata.status, 200);
	assert.equal(
		"data" in nodata.body
			? (nodata.body.data as { status: string }).status
			: undefined,
		"nodata",
	);
});

test("terrain point refuses an unknown source version", () => {
	const response = routeRequest(
		"GET",
		"/v1/terrain/elevation/point?x=115&y=215&version=missing",
		testContext({ terrainProvider: createSyntheticTerrainProvider() }),
	);
	assert.equal(response.status, 404);
});

test("terrain point validates coordinates and interpolation", () => {
	const context = testContext({
		terrainProvider: createSyntheticTerrainProvider(),
	});
	assert.equal(
		routeRequest("GET", "/v1/terrain/elevation/point?x=nope&y=215", context)
			.status,
		400,
	);
	assert.equal(
		routeRequest(
			"GET",
			"/v1/terrain/elevation/point?x=115&y=215&interpolation=cubic",
			context,
		).status,
		400,
	);
});

test("terrain raster validation protects the published contract", () => {
	const provider = createSyntheticTerrainProvider();
	const source = provider.getSource();
	assert.ok(source);
	assert.deepEqual(validateTerrainRaster(source), {
		valid: true,
		errors: [],
	});
	assert.equal(source.tileHash, source.contentHash);
	assert.equal(source.coverage.footprintHash.startsWith("sha256:"), true);
});

test("remote terrain preview samples upstream without persisting a raster", async () => {
	let requested: URL | undefined;
	const provider = createRemoteTerrainProvider({
		endpoint: "https://example.test/ImageServer/getSamples",
		source: {
			id: "ea-lidar-composite-dtm-2m",
			version: "remote-preview",
			provenance: "remote-preview",
			crs: "EPSG:27700",
			horizontalDatum: "OSGB36",
			horizontalTransformation: "OSTN15",
			verticalDatum: "ODN",
			verticalModel: "OSGM15",
			resolutionMetres: 2,
			noData: -3.4028235e38,
			uncertainty: { metric: "rmse", valueMetres: 0.15 },
			coverage: {
				kind: "bbox",
				bbox: [80000, 4000, 658081.8635, 666000],
				footprintHash: "fixture-footprint",
			},
		},
		fetcher: async (input) => {
			requested = new URL(input.toString());
			return new Response(
				JSON.stringify({ samples: [{ value: 123.4 }] }),
			);
		},
	});
	const response = await routeAsync(
		"GET",
		"/v1/terrain/elevation/point?x=530000&y=180000&interpolation=bilinear",
		testContext({ terrainAsyncProvider: provider }),
	);
	assert.equal(response.status, 200);
	assert.equal(
		"data" in response.body
			? (response.body.data as { value: number }).value
			: undefined,
		123.4,
	);
	assert.equal(requested?.searchParams.get("f"), "json");
	assert.equal(
		requested?.searchParams.get("interpolation"),
		"RSP_BilinearInterpolation",
	);
	assert.equal(
		requested?.searchParams.get("geometryType"),
		"esriGeometryPoint",
	);
});

test("remote terrain preview honors exact coverage and maps upstream failures", async () => {
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
	let requestCount = 0;
	const provider = createRemoteTerrainProvider({
		endpoint: "https://example.test/ImageServer/getSamples",
		coverageEndpoint: "https://example.test/FeatureServer/5/query",
		source,
		fetcher: async (input) => {
			requestCount += 1;
			const url = new URL(input.toString());
			if (url.pathname.includes("FeatureServer"))
				return new Response(JSON.stringify({ features: [] }));
			throw new Error("should not sample outside coverage");
		},
	});
	const outside = await routeAsync(
		"GET",
		"/v1/terrain/elevation/point?x=530000&y=180000",
		testContext({ terrainAsyncProvider: provider }),
	);
	assert.equal(outside.status, 200);
	assert.equal(
		"data" in outside.body
			? (outside.body.data as { status: string }).status
			: undefined,
		"outside_coverage",
	);
	assert.equal(requestCount, 1);

	const unavailable = await routeAsync(
		"GET",
		"/v1/terrain/elevation/point?x=530000&y=180000",
		testContext({
			terrainAsyncProvider: createRemoteTerrainProvider({
				endpoint: "https://example.test/ImageServer/getSamples",
				source,
				fetcher: async () => {
					throw new Error("upstream unavailable");
				},
			}),
		}),
	);
	assert.equal(unavailable.status, 503);
});
