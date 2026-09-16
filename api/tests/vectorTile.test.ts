import assert from "node:assert/strict";
import test from "node:test";
import { encodeTile, TILE_EXTENT } from "../src/mapResource/vectorTile";
import { clipRing, signedArea, wind } from "../src/mapResource/tileGrid";
import { decodeTile, packedVarints, readFields } from "./vectorTileFixtures";

/**
 * The tile writer, checked against the Mapbox Vector Tile 2.1 specification
 * rather than against a reader written beside it. The decoder below reads the
 * protobuf wire format from its own rules, and the first test holds the
 * geometry encoder to the worked example the specification publishes, so a
 * shared misreading of the format cannot pass unnoticed.
 */

test("encodes a polygon the way the vector tile specification does", () => {
	// Specification 2.1, "Example Polygon": the ring (3,6) (8,12) (20,34)
	// encodes as MoveTo 1, LineTo 2, ClosePath with zigzagged deltas.
	const tile = encodeTile("example", [
		{
			id: 1,
			rings: [
				[
					[3, 6],
					[8, 12],
					[20, 34],
				],
			],
			properties: {},
		},
	]);
	const layer = readFields(tile).find((entry) => entry.field === 3)!;
	const feature = readFields(layer.value as Buffer).find(
		(entry) => entry.field === 2,
	)!;
	const geometry = readFields(feature.value as Buffer).find(
		(entry) => entry.field === 4,
	)!;
	assert.deepEqual(
		packedVarints(geometry.value as Buffer),
		[9, 6, 12, 18, 10, 12, 24, 44, 15],
	);
});

test("round-trips a feature's rings, id and properties", () => {
	const outer: Array<[number, number]> = [
		[10, 10],
		[100, 10],
		[100, 100],
		[10, 100],
	];
	const hole: Array<[number, number]> = [
		[40, 40],
		[40, 60],
		[60, 60],
		[60, 40],
	];
	const tile = encodeTile("boundaries", [
		{
			id: 7,
			rings: [wind(outer, true), wind(hole, false)],
			properties: { code: "E06000001", name: "Hartlepool" },
		},
	]);
	const [layer] = decodeTile(tile);
	assert.equal(layer!.name, "boundaries");
	assert.equal(layer!.version, 2);
	assert.equal(layer!.extent, TILE_EXTENT);
	assert.equal(layer!.features.length, 1);
	const [feature] = layer!.features;
	assert.equal(feature!.id, 7);
	assert.deepEqual(feature!.properties, {
		code: "E06000001",
		name: "Hartlepool",
	});
	assert.equal(feature!.rings.length, 2);
	// An outer ring runs clockwise on the screen and a hole the other way, or a
	// renderer fills the hole and knocks out the area.
	assert.ok(signedArea(feature!.rings[0]!) > 0);
	assert.ok(signedArea(feature!.rings[1]!) < 0);
});

test("leaves a feature out of a tile it does not reach", () => {
	const tile = encodeTile("boundaries", [
		{
			id: 1,
			rings: [
				[
					[0, 0],
					[1, 0],
				],
			],
			properties: {},
		},
	]);
	assert.deepEqual(decodeTile(tile)[0]!.features, []);
});

test("cuts a ring to the tile and its buffer, keeping the cut on the edge", () => {
	// A ring crossing the right-hand edge comes back inside the buffer, cut at
	// the boundary rather than at whatever coordinate it crossed.
	const clipped = clipRing(
		[
			[0, 0],
			[TILE_EXTENT * 2, 0],
			[TILE_EXTENT * 2, 100],
			[0, 100],
		],
		64,
	);
	assert.ok(clipped.length >= 3);
	assert.ok(
		clipped.every(([x]) => x <= TILE_EXTENT + 64),
		"a clipped ring stays inside the buffer",
	);
	assert.ok(clipped.some(([x]) => x === TILE_EXTENT + 64));
});

test("drops a ring that misses the tile altogether", () => {
	assert.deepEqual(
		clipRing([
			[-5000, -5000],
			[-4000, -5000],
			[-4000, -4000],
		]),
		[],
	);
});
