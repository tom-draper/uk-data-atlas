import assert from "node:assert/strict";
import test from "node:test";
import type { GeoJsonGeometry } from "@uk-data-atlas/atlas-runtime/geometry";
import { packedWkb, toWkb } from "@uk-data-atlas/atlas-runtime/maps";
import { packGeometry } from "@uk-data-atlas/geography/packed-geometry";

const ring = (west: number, south: number, size: number) => [
	[west, south],
	[west + size, south],
	[west + size, south + size],
	[west, south + size],
	[west, south],
];

test("writes a packed area as the WKB its GeoJSON would be", () => {
	const polygon: GeoJsonGeometry = {
		type: "Polygon",
		coordinates: [ring(0, 50, 4), ring(1, 51, 1)],
	};
	const multipolygon: GeoJsonGeometry = {
		type: "MultiPolygon",
		coordinates: [[ring(0, 50, 1)], [ring(2, 50, 3), ring(3, 51, 1)]],
	};
	for (const geometry of [polygon, multipolygon])
		assert.deepEqual(packedWkb(packGeometry(geometry)), {
			type: geometry.type,
			wkb: toWkb(geometry),
		});
});

test("writes a collection of polygons as one multipolygon", () => {
	const packed = packGeometry({
		type: "GeometryCollection",
		geometries: [
			{ type: "Polygon", coordinates: [ring(0, 50, 1)] },
			{ type: "MultiPolygon", coordinates: [[ring(2, 50, 1)]] },
		],
	});
	assert.deepEqual(packedWkb(packed), {
		type: "MultiPolygon",
		wkb: toWkb({
			type: "MultiPolygon",
			coordinates: [[ring(0, 50, 1)], [ring(2, 50, 1)]],
		}),
	});
	assert.equal(
		packedWkb(packGeometry({ type: "Point", coordinates: [0, 50] })),
		undefined,
	);
});
