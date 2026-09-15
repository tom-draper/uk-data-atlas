import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { AreaGeometryCache } from "../src/areaGeometry";
import {
	route,
	registry,
	geographyInventory,
	areaLookup,
	crosswalkInventory,
	crosswalkLookup,
} from "./routeFixtures";

test("finds every area containing a point and labels shared borders", () => {
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
									[0, 0],
									[3, 0],
									[3, 3],
									[0, 3],
									[0, 0],
								],
								[
									[1, 1],
									[2, 1],
									[2, 2],
									[1, 2],
									[1, 1],
								],
							],
						},
					},
					{
						properties: { WD25CD: "E05000002" },
						geometry: {
							type: "Polygon",
							coordinates: [
								[
									[3, 0],
									[4, 0],
									[4, 3],
									[3, 3],
									[3, 0],
								],
							],
						},
					},
				],
			}),
		);
		const areaGeometryCache = new AreaGeometryCache(
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
			]),
		);

		const boundary = route(
			"GET",
			"/v1/areas:contains?lng=3&lat=0.5&geography=ward&release=2025-01-en-ward",
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
		assert.equal(boundary.status, 200);
		const data = "data" in boundary.body ? boundary.body.data : undefined;
		assert.deepEqual(data, {
			point: { lng: 3, lat: 0.5 },
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			boundaryRule: "included",
			matches: [
				{
					id: "ward/2025-01-en-ward/E05000001",
					code: "E05000001",
					name: "Example ward",
					aliases: ["Enghraifft ward"],
					containment: "boundary",
					geometrySource: { sourceCrs: "EPSG:4326" },
				},
				{
					id: "ward/2025-01-en-ward/E05000002",
					code: "E05000002",
					name: "Other ward",
					containment: "boundary",
					geometrySource: { sourceCrs: "EPSG:4326" },
				},
			],
		});

		const hole = route(
			"GET",
			"/v1/areas:contains?lng=1.5&lat=1.5&geography=ward&release=2025-01-en-ward",
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
		assert.equal(hole.status, 200);
		assert.deepEqual("data" in hole.body && hole.body.data, {
			point: { lng: 1.5, lat: 1.5 },
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			boundaryRule: "included",
			matches: [],
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("validates point lookup coordinates and reports unavailable geometry", () => {
	const invalid = route(
		"GET",
		"/v1/areas:contains?lng=181&lat=53&geography=ward&release=2025-01-en-ward",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(invalid.status, 400);

	const unavailable = route(
		"GET",
		"/v1/areas:contains?lng=-2&lat=53&geography=ward&release=2025-01-en-ward",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(unavailable.status, 503);
});
