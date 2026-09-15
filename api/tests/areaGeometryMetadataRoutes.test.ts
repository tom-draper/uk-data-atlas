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

test("measures an area's geometry without returning its coordinates", () => {
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
							type: "Polygon",
							coordinates: [
								[
									[-2, 54],
									[-1, 54],
									[-1, 55],
									[-2, 55],
									[-2, 54],
								],
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

		const response = route(
			"GET",
			"/v1/areas/ward/2025-01-en-ward/E05000001/geometry/metadata",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			areaGeometryCache,
		);
		assert.equal(response.status, 200);
		const data = ("data" in response.body && response.body.data) as Record<
			string,
			never
		>;
		// The point of the endpoint: measurements, and no coordinates beyond
		// the three single points that are themselves the answer.
		assert.equal("geometry" in data, false);
		assert.deepEqual(data.boundingBox, [-2, 54, -1, 55]);
		assert.equal(data.labelPointMethod, "centroid");
		assert.deepEqual(data.labelPoint, data.centroid);
		assert.deepEqual(data.geometryExtent, {
			parts: 1,
			rings: 1,
			vertices: 5,
		});

		const area = data.area as unknown as Record<string, number>;
		const perimeter = data.perimeter as unknown as Record<string, number>;
		// A degree of longitude at 54°N is about 65 km, a degree of latitude
		// about 111 km, so the cell is roughly 7,300 km².
		assert.ok(area.km2! > 7_200 && area.km2! < 7_400, `${area.km2} km2`);
		assert.equal(area.hectares, area.m2! / 10_000);
		assert.equal(area.km2, area.m2! / 1_000_000);
		assert.equal(perimeter.km, perimeter.m! / 1000);
		assert.match(
			(data.method as unknown as Record<string, string>).caveat!,
			/not a published land-area statistic/,
		);

		const unknownArea = route(
			"GET",
			"/v1/areas/ward/2025-01-en-ward/E05099999/geometry/metadata",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			areaGeometryCache,
		);
		assert.equal(unknownArea.status, 404);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("refuses to measure geometry that carries no polygon", () => {
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
		const response = route(
			"GET",
			"/v1/areas/ward/2025-01-en-ward/E05000001/geometry/metadata",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			new AreaGeometryCache(root, sources),
		);
		// A point source can still be served as geometry; it just cannot be
		// measured, and says so rather than reporting zero.
		assert.equal(response.status, 422);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
