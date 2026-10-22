import assert from "node:assert/strict";
import test from "node:test";
import { compileTileset } from "@uk-data-atlas/map-tiles/compileTileset";
import { readHeader, readMetadata } from "./pmtilesFixtures";

const square = (west: number, south: number, size: number) => ({
	type: "Polygon",
	coordinates: [
		[
			[west, south],
			[west + size, south],
			[west + size, south + size],
			[west, south + size],
			[west, south],
		],
	],
});

const options = {
	name: "ward/test",
	description: "Test wards",
	attribution: "Contains test data",
	names: new Map([["E05000002", "East"]]),
};

test("tiles a coverage and numbers features by code", () => {
	const tileset = compileTileset(
		new Map([
			["E05000002", square(0, 51, 0.1)],
			["E05000001", square(-0.1, 51, 0.1)],
		]),
		options,
	);
	assert.deepEqual(
		[...tileset.ids],
		[
			["E05000001", 1],
			["E05000002", 2],
		],
	);
	assert.ok(tileset.tileCount > 0);
	assert.deepEqual(
		tileset.bounds.map((value) => Number(value.toFixed(6))),
		[-0.1, 51, 0.1, 51.1],
	);
	const header = readHeader(tileset.archive);
	assert.equal(header.minZoom, tileset.zooms[0]!.minZoom);
	const metadata = readMetadata(tileset.archive) as Record<string, unknown>;
	assert.equal(metadata.name, "ward/test");
	assert.equal(metadata.attribution, "Contains test data");
});

// Three areas on one edge cannot all be drawn: one would cover another.
test("refuses areas that overlap", () => {
	assert.throws(
		() =>
			compileTileset(
				new Map([
					["E05000001", square(0, 51, 0.1)],
					["E05000002", square(0, 51, 0.1)],
					["E05000003", square(0, 51, 0.1)],
				]),
				options,
			),
		/ward\/test is not a coverage/,
	);
});

test("refuses a release with no areas", () => {
	assert.throws(
		() => compileTileset(new Map(), options),
		/No geometry is available for ward\/test/,
	);
});
