import assert from "node:assert/strict";
import test from "node:test";
import type { GeoJsonGeometry } from "../src/areaGeometry";
import { geometryBounds } from "../src/areaContainment";
import {
	packedBounds,
	packGeometry,
	unpackGeometry,
} from "../src/packedGeometry";

const geometries: GeoJsonGeometry[] = [
	{ type: "Point", coordinates: [-0.1283539, 51.5039908] },
	{
		type: "LineString",
		coordinates: [
			[0, 0],
			[1, 1],
		],
	},
	{
		type: "Polygon",
		coordinates: [
			[
				[0, 0],
				[4, 0],
				[4, 4],
				[0, 0],
			],
			[
				[1, 1],
				[2, 1],
				[2, 2],
				[1, 1],
			],
		],
	},
	{
		type: "MultiPolygon",
		coordinates: [
			[
				[
					[-5.93, 54.59],
					[-5.92, 54.59],
					[-5.92, 54.6],
					[-5.93, 54.59],
				],
			],
			[
				[
					[0.1, 0.2],
					[0.3, 0.2],
					[0.3, 0.4],
					[0.1, 0.2],
				],
			],
		],
	},
	{
		type: "GeometryCollection",
		geometries: [
			{ type: "Point", coordinates: [3, 4] },
			{
				type: "LineString",
				coordinates: [
					[5, 6],
					[7, 8],
				],
			},
		],
	},
	// Positions with a third number keep it.
	{
		type: "LineString",
		coordinates: [
			[1, 2, 3],
			[4, 5, 6],
		],
	},
];

test("round-trips every geometry type exactly", () => {
	for (const geometry of geometries) {
		const packed = packGeometry(geometry);
		assert.deepEqual(unpackGeometry(packed), geometry);
		assert.deepEqual(packedBounds(packed), geometryBounds(geometry));
	}
});

test("stores standard geometry as typed arrays", () => {
	const packed = packGeometry(geometries[3]!);
	assert.equal(packed.kind, "packed");
	if (packed.kind !== "packed") return;
	assert.ok(packed.positions instanceof Float64Array);
	assert.equal(packed.positions.length, 16);
	assert.deepEqual(
		packed.counts.map((level) => [...level]),
		[[2], [1, 1], [4, 4]],
	);
});

test("keeps geometry it cannot pack uniformly as it came", () => {
	const mixed: GeoJsonGeometry = {
		type: "LineString",
		coordinates: [
			[1, 2],
			[3, 4, 5],
		],
	};
	const unknown: GeoJsonGeometry = { type: "Curve", coordinates: [] };
	for (const geometry of [mixed, unknown]) {
		const packed = packGeometry(geometry);
		assert.equal(packed.kind, "raw");
		assert.equal(unpackGeometry(packed), geometry);
	}
});
