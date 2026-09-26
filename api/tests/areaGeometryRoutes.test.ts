import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
	AreaGeometryCache,
	type GeometrySourceLookup,
} from "../src/areaGeometry";
import {
	route,
	registry,
	geographyInventory,
	areaLookup,
	crosswalkInventory,
	crosswalkLookup,
} from "./routeFixtures";

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
			areaGeometryCache,
		);
		assert.equal(unknownArea.status, 404);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
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
