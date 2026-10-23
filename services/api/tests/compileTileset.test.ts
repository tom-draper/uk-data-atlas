import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync } from "node:zlib";
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
	gzip: gzipSync,
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

test("compiled polygon archives retain overlapping areas while strict compilation rejects them", async () => {
	const { compilePolygonArchive } =
		await import("@uk-data-atlas/map-tiles/compileArchive");
	const { readTile } = await import("./pmtilesFixtures");
	const { decodeTile } = await import("./vectorTileFixtures");
	const areas = new Map([
		["E05000003", square(0, 51, 0.1)],
		["E05000001", square(0, 51, 0.1)],
		["E05000002", square(0, 51, 0.1)],
	]);
	assert.throws(() => compileTileset(areas, options), /is not a coverage/);
	const result = compilePolygonArchive(areas, options);
	const tile = readTile(result.archive, 0);
	assert.ok(tile);
	const [layer] = decodeTile(tile);
	assert.equal(layer?.name, "boundaries");
	assert.deepEqual(
		layer.features.map(({ id, properties }) => [id, properties.code]),
		[
			[3, "E05000003"],
			[1, "E05000001"],
			[2, "E05000002"],
		],
	);
	assert.ok(layer.features.every((feature) => feature.rings.length === 1));
	assert.deepEqual(areas.get("E05000001"), square(0, 51, 0.1));
});

test("reserves input IDs when a degenerate area disappears from generalised geometry", async () => {
	const { readTile } = await import("./pmtilesFixtures");
	const { decodeTile } = await import("./vectorTileFixtures");
	const result = compileTileset(
		new Map([
			["A", square(0, 51, 0.1)],
			["B", square(0.2, 51, 0)],
			["C", square(0.3, 51, 0.1)],
		]),
		options,
	);
	assert.deepEqual(
		[...result.ids],
		[
			["A", 1],
			["B", 2],
			["C", 3],
		],
	);
	const tile = readTile(result.archive, 0);
	assert.ok(tile);
	assert.deepEqual(
		decodeTile(tile)[0]?.features.map(({ id, properties }) => [
			properties.code,
			id,
		]),
		[
			["A", 1],
			["C", 3],
		],
	);
});
