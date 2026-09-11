import assert from "node:assert/strict";
import test from "node:test";
import {
	canServeAsWgs84,
	geometryProvenance,
	refusalFor,
	toWgs84Geometry,
} from "../src/reprojection";

// Reference values from PROJ's cct running EPSG:1314 (OSGB36 to WGS 84 (6))
// as an explicit pipeline: inverse British National Grid, then the Helmert
// shift in the position vector convention.
const REFERENCES: Array<[[number, number], [number, number]]> = [
	[
		[651409.903, 313177.27],
		[1.71605199, 52.657978599],
	],
	[
		[325000, 673000],
		[-3.202386182, 55.944167047],
	],
	[
		[150000, 50000],
		[-5.511662554, 50.296848418],
	],
	[
		[530000, 180000],
		[-0.12835394, 51.503990828],
	],
];

test("matches PROJ for British National Grid points across Great Britain", () => {
	for (const [grid, [lon, lat]] of REFERENCES) {
		const { coordinates } = toWgs84Geometry(
			{ type: "Point", coordinates: grid },
			"EPSG:27700",
		) as { coordinates: [number, number] };
		// Output is rounded to 1e-7 degrees, about a centimetre.
		assert.ok(Math.abs(coordinates[0] - lon) < 1e-7, `${grid} longitude`);
		assert.ok(Math.abs(coordinates[1] - lat) < 1e-7, `${grid} latitude`);
	}
});

test("reprojects every coordinate of nested and collected geometries", () => {
	const collection = toWgs84Geometry(
		{
			type: "GeometryCollection",
			geometries: [
				{
					type: "MultiPolygon",
					coordinates: [
						[
							[
								[530000, 180000],
								[530100, 180000],
								[530000, 180000],
							],
						],
					],
				},
			],
		},
		"EPSG:27700",
	) as { geometries: Array<{ coordinates: number[][][][] }> };
	const ring = collection.geometries[0].coordinates[0][0];
	assert.equal(ring.length, 3);
	assert.ok(ring.every(([lon, lat]) => lon > -0.2 && lon < 0 && lat > 51.5));
});

test("leaves WGS84 geometry alone and refuses an unknown CRS", () => {
	const point = { type: "Point", coordinates: [-2.24, 53.48] };
	assert.equal(toWgs84Geometry(point, "EPSG:4326"), point);
	assert.equal(
		toWgs84Geometry(point, "urn:ogc:def:crs:OGC:1.3:CRS84"),
		point,
	);
	assert.throws(
		() => toWgs84Geometry(point, "EPSG:3857"),
		/No transformation to WGS84 is available from EPSG:3857\./,
	);
	assert.deepEqual(
		["EPSG:4326", "EPSG:27700", "EPSG:3857"].map(canServeAsWgs84),
		[true, true, false],
	);
	assert.deepEqual(geometryProvenance("EPSG:4326"), {
		sourceCrs: "EPSG:4326",
	});
	assert.equal(
		geometryProvenance("EPSG:27700").transformation?.epsg,
		"EPSG:1314",
	);
});

test("refuses Northern Ireland areas from British National Grid only", () => {
	assert.match(
		refusalFor("EPSG:27700", "N09000003") ?? "",
		/Northern Ireland geometry in British National Grid releases is not served/,
	);
	assert.equal(refusalFor("EPSG:27700", "E06000046"), undefined);
	assert.equal(refusalFor("EPSG:4326", "N09000003"), undefined);
});
