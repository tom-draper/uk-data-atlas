import assert from "node:assert/strict";
import test from "node:test";
import type { LookupPoint } from "../src/pointLookup";
import { route as routeRequest } from "../src/routes";
import { testContext } from "./routeFixtures";

const get = (url: string) =>
	routeRequest("GET", url, testContext()) as {
		status: number;
		body: { data?: { point?: LookupPoint; targetCrs?: string } };
	};

test("normalises supported coordinate inputs to WGS84 without a boundary release", () => {
	const wgs84 = get("/v1/coordinates:convert?lng=-0.1284&lat=51.5040");
	assert.equal(wgs84.status, 200);
	assert.deepEqual(wgs84.body.data?.point, {
		lng: -0.1284,
		lat: 51.504,
		crs: "EPSG:4326",
		precision: {
			decimalPlaces: { lng: 4, lat: 4 },
			uncertaintyM: 5.56,
			basis: "decimal-places",
		},
	});
	const britishGrid = get(
		"/v1/coordinates:convert?crs=EPSG:27700&gridref=TQ3000080000",
	);
	assert.equal(britishGrid.status, 200);
	assert.equal(britishGrid.body.data?.targetCrs, "EPSG:4326");
	assert.equal(
		britishGrid.body.data?.point?.input?.gridReference?.value,
		"TQ 30000 80000",
	);
	const irishGrid = get(
		"/v1/coordinates:convert?crs=EPSG:29902&easting=333500&northing=373500",
	);
	assert.equal(irishGrid.status, 200);
	assert.equal(
		irishGrid.body.data?.point?.input?.transformation.epsg,
		"EPSG:1641",
	);
});

test("refuses an ambiguous or unsupported coordinate conversion", () => {
	assert.equal(get("/v1/coordinates:convert?lng=0").status, 400);
	assert.equal(
		get("/v1/coordinates:convert?crs=EPSG:3857&lng=0&lat=0").status,
		400,
	);
	assert.equal(
		get(
			"/v1/coordinates:convert?crs=EPSG:27700&gridref=TQ3000080000&easting=530000&northing=180000",
		).status,
		400,
	);
});
