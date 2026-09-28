import assert from "node:assert/strict";
import test from "node:test";
import {
	buildArchive,
	tileId,
	TILE_TYPE_MVT,
	type ArchiveTile,
} from "../src/mapResource/pmtiles";
import { readHeader, readMetadata, readTile } from "./pmtilesFixtures";

/**
 * The archive format, checked by reading it back with a reader written from the
 * specification rather than from the writer.
 *
 * The tile ordering is checked by the property that defines it instead of by a
 * table of expected numbers: a Hilbert curve visits every tile of a zoom once,
 * and each tile it visits touches the one before it. A wrong curve fails that
 * however plausible its numbers look.
 */

const details = {
	minZoom: 0,
	maxZoom: 3,
	bounds: [-8.7, 49.8, 1.9, 61.0] as [number, number, number, number],
	centre: [-2.5, 54.5, 5] as [number, number, number],
	metadata: { name: "boundaries", attribution: "Contains OS data" },
};

const tile = (z: number, x: number, y: number, body: string): ArchiveTile => ({
	z,
	x,
	y,
	body: Buffer.from(body, "utf8"),
});

test("orders tiles along a Hilbert curve covering each zoom", () => {
	for (let zoom = 1; zoom <= 5; zoom += 1) {
		const size = 2 ** zoom;
		const first = (4 ** zoom - 1) / 3;
		const byId = new Map<number, [number, number]>();
		for (let x = 0; x < size; x += 1)
			for (let y = 0; y < size; y += 1)
				byId.set(tileId(zoom, x, y), [x, y]);

		// Every tile of the zoom gets its own id, inside that zoom's block.
		assert.equal(byId.size, size * size, `zoom ${zoom} repeats an id`);
		for (const id of byId.keys())
			assert.ok(
				id >= first && id < first + size * size,
				`zoom ${zoom} put a tile outside its own range`,
			);

		// Consecutive ids are neighbouring tiles, which is what makes the
		// ordering worth using: panning reads one part of the file.
		for (let id = first; id < first + size * size - 1; id += 1) {
			const [x, y] = byId.get(id)!;
			const [nextX, nextY] = byId.get(id + 1)!;
			assert.equal(
				Math.abs(x - nextX) + Math.abs(y - nextY),
				1,
				`zoom ${zoom} jumps between ids ${id} and ${id + 1}`,
			);
		}
	}
	// Zoom 0 is the whole world and the first id.
	assert.equal(tileId(0, 0, 0), 0);
	assert.throws(() => tileId(1, 2, 0), /outside zoom/);
});

test("reads every tile back out of the archive", () => {
	const tiles = [
		tile(0, 0, 0, "world"),
		tile(1, 0, 0, "north west"),
		tile(1, 1, 0, "north east"),
		tile(2, 3, 2, "a corner"),
		tile(3, 4, 5, "somewhere"),
	];
	const archive = buildArchive(tiles, details);
	for (const entry of tiles)
		assert.deepEqual(
			readTile(archive, tileId(entry.z, entry.x, entry.y)),
			entry.body,
			`${entry.z}/${entry.x}/${entry.y}`,
		);
	// A tile the archive never held is absent rather than someone else's.
	assert.equal(readTile(archive, tileId(3, 0, 0)), undefined);
});

test("describes itself in the header the specification defines", () => {
	const archive = buildArchive([tile(0, 0, 0, "world")], details);
	const header = readHeader(archive);
	assert.equal(header.magic, "PMTiles");
	assert.equal(header.version, 3);
	assert.equal(header.tileType, TILE_TYPE_MVT);
	assert.equal(header.internalCompression, 2, "directories are gzipped");
	assert.equal(header.tileCompression, 2, "tiles are gzipped");
	assert.equal(header.clustered, 1);
	assert.equal(header.minZoom, 0);
	assert.equal(header.maxZoom, 3);
	assert.deepEqual(header.bounds, details.bounds);
	assert.deepEqual(header.centre, details.centre);
	// The sections follow the 127-byte header without a gap.
	assert.equal(header.rootOffset, 127);
	assert.equal(header.metadataOffset, 127 + header.rootLength);
	assert.equal(
		header.leafOffset,
		header.metadataOffset + header.metadataLength,
	);
	assert.equal(header.dataOffset, header.leafOffset + header.leafLength);
	assert.equal(archive.length, header.dataOffset + header.dataLength);
});

test("carries the layer's metadata for a renderer to read", () => {
	const archive = buildArchive([tile(0, 0, 0, "world")], details);
	assert.deepEqual(readMetadata(archive), details.metadata);
});

test("stores repeated tiles once and runs them together", () => {
	// A boundary layer repeats itself across empty sea, and the same bytes
	// should not be carried twice.
	const empty = "nothing here";
	const tiles = [
		tile(2, 0, 0, empty),
		tile(2, 0, 1, empty),
		tile(2, 1, 1, empty),
		tile(2, 1, 0, empty),
		tile(2, 2, 0, "a coast"),
	];
	const archive = buildArchive(tiles, details);
	const header = readHeader(archive);
	assert.equal(header.addressedTiles, 5);
	assert.equal(header.tileContents, 2, "identical tiles stored twice");
	// The four identical tiles are consecutive on the curve, so they collapse
	// into one entry with a run length, leaving two entries in all.
	assert.equal(header.tileEntries, 2);
	for (const entry of tiles)
		assert.deepEqual(
			readTile(archive, tileId(entry.z, entry.x, entry.y)),
			entry.body,
		);
});

test("moves entries into leaf directories when the root grows too large", () => {
	// A directory of consecutive ids and similar lengths compresses so well
	// that a boundary pyramid never needs leaves: even 65,000 tiles fit in an
	// 11KB root. Forcing the path takes tiles scattered across the grid, so the
	// ids step unevenly, with lengths that vary too.
	const tiles: ArchiveTile[] = [];
	for (let x = 0; x < 512; x += 3)
		for (let y = 0; y < 512; y += 1)
			tiles.push(
				tile(9, x, y, "q".repeat(1 + ((x * 7919 + y * 104729) % 900))),
			);
	const archive = buildArchive(tiles, details);
	const header = readHeader(archive);
	assert.ok(header.leafLength > 0, "no leaf directories were written");
	assert.ok(
		header.rootLength <= 16384,
		`the root directory is ${header.rootLength} bytes`,
	);
	// Reading still resolves through the leaves, at both ends and in between.
	for (const entry of [
		tiles[0]!,
		tiles[Math.floor(tiles.length / 2)]!,
		tiles[tiles.length - 1]!,
	])
		assert.deepEqual(
			readTile(archive, tileId(entry.z, entry.x, entry.y)),
			entry.body,
			`${entry.z}/${entry.x}/${entry.y}`,
		);
});
