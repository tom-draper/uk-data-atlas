import assert from "node:assert/strict";
import test from "node:test";
import type { Coordinate } from "@uk-data-atlas/geography/geometry-point-containment";
import { tileBounds } from "@uk-data-atlas/map-tiles/tileGrid";
import {
	boundsOf,
	tileFeatures,
	type MapFeature,
} from "@uk-data-atlas/map-tiles/tileset";

// Coordinates expressed on the zoom 2 world grid make the expected tile
// coordinates literal, including a polygon that only reaches the tile's buffer.
const square = (x: number, y: number, width: number): Coordinate[] =>
	[
		[x, y],
		[x + width, y],
		[x + width, y + width],
		[x, y + width],
		[x, y],
	].map(([column, row]) => [
		(column! / 16384) * 360 - 180,
		(Math.atan(Math.sinh(Math.PI * (1 - (2 * row!) / 16384))) * 180) /
			Math.PI,
	]);

test("tiles polygon parts in source order with holes and buffered neighbours across zoom changes", () => {
	const geometry = {
		type: "MultiPolygon",
		coordinates: [
			[square(12000, 12000, 100)],
			[square(4100, 4200, 100), square(4120, 4220, 20)],
			[square(4030, 4400, 4)],
		],
	};
	const feature: MapFeature = {
		id: 7,
		code: "islands",
		name: "Islands",
		geometry,
		bounds: boundsOf(geometry),
	};
	const address = { z: 2, x: 1, y: 1 };
	const expected = [
		{
			id: 7,
			properties: { code: "islands", name: "Islands" },
			rings: [
				[
					[4, 104],
					[104, 104],
					[104, 204],
					[4, 204],
				],
				[
					[24, 144],
					[44, 144],
					[44, 124],
					[24, 124],
				],
				[
					[-64, 304],
					[-62, 304],
					[-62, 308],
					[-64, 308],
				],
			],
		},
	];
	assert.deepEqual(
		tileFeatures([feature], address, tileBounds(address)),
		expected,
	);
	const world = { z: 0, x: 0, y: 0 };
	const all = tileFeatures([feature], world, tileBounds(world));
	assert.equal(all.length, 1);
	assert.equal(all[0]?.rings.length, 4);
	assert.deepEqual(
		tileFeatures([feature], address, tileBounds(address)),
		expected,
	);
	const distant = { z: 2, x: 0, y: 3 };
	assert.deepEqual(tileFeatures([feature], distant, tileBounds(distant)), []);
});
