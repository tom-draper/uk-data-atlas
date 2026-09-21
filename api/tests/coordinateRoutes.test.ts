import assert from "node:assert/strict";
import test from "node:test";
import type { LookupPoint } from "../src/pointLookup";
import { route as routeRequest } from "../src/routes";
import { testContext } from "./routeFixtures";

const get = (url: string) =>
	routeRequest("GET", url, testContext()) as {
	status: number;
		body: {
			data?: {
				point?: LookupPoint;
				targetCrs?: string;
					target?: {
					crs: string;
					easting: number;
					northing: number;
					uncertaintyM: number;
					transformation: { epsg: string; direction: string };
					gridReference?: {
						value: string;
						digits: number;
						cellSizeM: number;
						position: string;
					};
				};
			};
		};
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

test("converts a normalised WGS84 point into a requested national grid", () => {
	const britishGrid = get(
		"/v1/coordinates:convert?lng=-0.12835394&lat=51.503990828&to=EPSG:27700",
	);
	assert.equal(britishGrid.status, 200);
	assert.equal(britishGrid.body.data?.targetCrs, "EPSG:27700");
	assert.equal(britishGrid.body.data?.target?.crs, "EPSG:27700");
	assert.ok(Math.abs((britishGrid.body.data?.target?.easting ?? 0) - 530000) < 0.02);
	assert.ok(Math.abs((britishGrid.body.data?.target?.northing ?? 0) - 180000) < 0.02);
	assert.equal(
		britishGrid.body.data?.target?.transformation.epsg,
		"EPSG:1314",
	);
	assert.equal(
		britishGrid.body.data?.target?.transformation.direction,
		"inverse",
	);
	assert.deepEqual(britishGrid.body.data?.target?.gridReference, {
		value: "TQ 3000 8000",
		digits: 4,
		cellSizeM: 10,
		position: "containing-cell",
	});
	const coarserReference = get(
		"/v1/coordinates:convert?lng=-0.12835394&lat=51.503990828&to=EPSG:27700&gridrefDigits=2",
	);
	assert.equal(
		coarserReference.body.data?.target?.gridReference?.value,
		"TQ 30 80",
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
	assert.equal(
		get("/v1/coordinates:convert?lng=0&lat=0&to=EPSG:27700").status,
		400,
	);
	assert.equal(
		get("/v1/coordinates:convert?lng=-0.1&lat=51.5&gridrefDigits=6").status,
		400,
	);
	assert.equal(
		get("/v1/coordinates:convert?lng=-0.1&lat=51.5&gridrefDigits=2").status,
		400,
	);
});
