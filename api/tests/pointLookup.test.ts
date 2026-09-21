import assert from "node:assert/strict";
import test from "node:test";
import { parseLookupCoordinate, parseLookupCrs } from "../src/pointLookup";

test("normalises British National Grid input while retaining its transformation", () => {
	const point = parseLookupCoordinate(
		"EPSG:27700",
		{ easting: "530000.0", northing: "180000.00" },
		4,
	);
	assert.deepEqual(point?.input, {
		crs: "EPSG:27700",
		easting: 530000,
		northing: 180000,
		transformation: {
			name: "OSGB36 to WGS 84 (6)",
			epsg: "EPSG:1314",
			accuracyM: 2,
			areaOfUse: "Great Britain onshore and the Isle of Man.",
		},
	});
	assert.ok(Math.abs((point?.lng ?? 0) - -0.12835394) < 1e-7);
	assert.ok(Math.abs((point?.lat ?? 0) - 51.503990828) < 1e-7);
	assert.deepEqual(point?.precision, {
		decimalPlaces: { easting: 1, northing: 2 },
		uncertaintyM: 6,
		basis: "stated-accuracy-and-transformation",
	});
});

test("reads Irish Grid precision conservatively and accepts no other input CRS", () => {
	const point = parseLookupCoordinate("EPSG:29902", {
		easting: "333500",
		northing: "373500",
	});
	assert.ok(Math.abs((point?.lng ?? 0) - -5.935443406) < 1e-7);
	assert.ok(Math.abs((point?.lat ?? 0) - 54.592112534) < 1e-7);
	assert.deepEqual(point?.precision, {
		decimalPlaces: { easting: 0, northing: 0 },
		uncertaintyM: 1.5,
		basis: "decimal-places-and-transformation",
	});
	assert.equal(parseLookupCrs(null), "EPSG:4326");
	assert.equal(parseLookupCrs("EPSG:3857"), undefined);
	assert.equal(
		parseLookupCoordinate("EPSG:27700", {
			easting: "1000000",
			northing: "180000",
		}),
		undefined,
	);
	assert.equal(
		parseLookupCoordinate("EPSG:4326", {
			lng: "-2",
			lat: "53",
			easting: "400000",
		}),
		undefined,
	);
});
