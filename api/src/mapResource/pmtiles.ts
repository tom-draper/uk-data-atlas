import { gzipSync } from "node:zlib";

/**
 * A PMTiles v3 archive: one file holding a whole tile pyramid.
 *
 * The alternative is tens of thousands of small files, which is the wrong
 * shape for a build artifact, for a CDN and for this repository. One archive
 * has one content hash, which is also what lets a client prove the tiles it
 * drew belong to the Atlas release it cited.
 *
 * Specification: PMTiles v3. Byte offsets and field order below are that
 * specification's; the header is exactly 127 bytes.
 */

const HEADER_BYTES = 127;
const ROOT_DIRECTORY_TARGET = 16384;

export const TILE_TYPE_MVT = 1;
const COMPRESSION_GZIP = 2;

/** Unsigned LEB128, the only integer encoding the directories use. */
const varint = (value: number, into: number[]) => {
	let rest = value;
	while (rest > 0x7f) {
		into.push((rest & 0x7f) | 0x80);
		rest = Math.floor(rest / 128);
	}
	into.push(rest);
};

/**
 * Where a tile sits in the archive's ordering: the zoom's first id, plus the
 * tile's position along the Hilbert curve covering that zoom.
 *
 * The Hilbert order is what keeps neighbouring tiles near each other in the
 * file, so a map panning across a region reads from one part of it.
 */
export const tileId = (z: number, x: number, y: number) => {
	if (z < 0 || z > 26) throw new Error(`Zoom ${z} is outside PMTiles range.`);
	const size = 2 ** z;
	if (x < 0 || y < 0 || x >= size || y >= size)
		throw new Error(`Tile ${z}/${x}/${y} is outside zoom ${z}.`);
	let accumulated = (4 ** z - 1) / 3;
	let alongX = x;
	let alongY = y;
	let rotation = 0;
	for (let step = size / 2; step > 0; step /= 2) {
		const overX = (alongX & step) > 0 ? 1 : 0;
		const overY = (alongY & step) > 0 ? 1 : 0;
		accumulated += step * step * ((3 * overX) ^ overY);
		// Each quadrant of the curve is the one below it, rotated.
		if (overY === 0) {
			if (overX === 1) {
				alongX = step - 1 - alongX;
				alongY = step - 1 - alongY;
			}
			rotation = alongX;
			alongX = alongY;
			alongY = rotation;
		}
	}
	return accumulated;
};

type Entry = {
	tileId: number;
	offset: number;
	length: number;
	/** How many consecutive tile ids this entry answers; 0 marks a leaf. */
	runLength: number;
};

/**
 * A directory as the specification lays it out: the count, then every entry's
 * id as a step from the one before, then all the run lengths, then all the
 * lengths, then all the offsets. An offset that continues directly from the
 * previous entry is written as zero rather than repeated.
 */
const serialiseDirectory = (entries: Entry[]) => {
	const bytes: number[] = [];
	varint(entries.length, bytes);
	let previousId = 0;
	for (const entry of entries) {
		varint(entry.tileId - previousId, bytes);
		previousId = entry.tileId;
	}
	for (const entry of entries) varint(entry.runLength, bytes);
	for (const entry of entries) varint(entry.length, bytes);
	for (const [index, entry] of entries.entries()) {
		const previous = entries[index - 1];
		if (
			previous &&
			entry.offset === previous.offset + previous.length &&
			index > 0
		)
			varint(0, bytes);
		else varint(entry.offset + 1, bytes);
	}
	return Buffer.from(bytes);
};

/**
 * Fit the directory into a root a reader can fetch in one request, moving the
 * entries into leaf directories and doubling how many go in each until the
 * root that points at them is small enough.
 */
const buildDirectories = (entries: Entry[]) => {
	const root = serialiseDirectory(entries);
	const compressed = gzipSync(root);
	if (compressed.length <= ROOT_DIRECTORY_TARGET)
		return { root: compressed, leaves: Buffer.alloc(0) };
	for (let perLeaf = 4096; ; perLeaf *= 2) {
		const rootEntries: Entry[] = [];
		const blocks: Buffer[] = [];
		let offset = 0;
		for (let at = 0; at < entries.length; at += perLeaf) {
			const group = entries.slice(at, at + perLeaf);
			const leaf = gzipSync(serialiseDirectory(group));
			blocks.push(leaf);
			rootEntries.push({
				tileId: group[0]!.tileId,
				offset,
				length: leaf.length,
				runLength: 0,
			});
			offset += leaf.length;
		}
		const packed = gzipSync(serialiseDirectory(rootEntries));
		if (packed.length <= ROOT_DIRECTORY_TARGET || rootEntries.length === 1)
			return { root: packed, leaves: Buffer.concat(blocks) };
	}
};

export type ArchiveTile = { z: number; x: number; y: number; body: Buffer };

export type ArchiveDetails = {
	minZoom: number;
	maxZoom: number;
	/** Degrees, as the archive advertises its coverage. */
	bounds: [west: number, south: number, east: number, north: number];
	centre: [longitude: number, latitude: number, zoom: number];
	metadata: Record<string, unknown>;
};

const e7 = (degrees: number) => Math.round(degrees * 10_000_000);

/**
 * One archive from a pyramid of tiles.
 *
 * Tiles with identical bytes are stored once: a boundary layer repeats itself
 * across empty sea and across a zoom where nothing changed, and there is no
 * reason to carry the same bytes twice. Consecutive ids answered by the same
 * bytes collapse into a single entry with a run length.
 */
export const buildArchive = (
	tiles: ArchiveTile[],
	details: ArchiveDetails,
): Buffer => {
	const ordered = tiles
		.map((tile) => ({
			id: tileId(tile.z, tile.x, tile.y),
			body: tile.body,
		}))
		.sort((left, right) => left.id - right.id);

	const blocks: Buffer[] = [];
	const storedAt = new Map<string, { offset: number; length: number }>();
	const entries: Entry[] = [];
	let dataLength = 0;
	for (const tile of ordered) {
		const body = gzipSync(tile.body);
		const key = body.toString("base64");
		let stored = storedAt.get(key);
		if (!stored) {
			stored = { offset: dataLength, length: body.length };
			storedAt.set(key, stored);
			blocks.push(body);
			dataLength += body.length;
		}
		const last = entries[entries.length - 1];
		if (
			last &&
			last.offset === stored.offset &&
			last.length === stored.length &&
			last.tileId + last.runLength === tile.id
		) {
			last.runLength += 1;
			continue;
		}
		entries.push({
			tileId: tile.id,
			offset: stored.offset,
			length: stored.length,
			runLength: 1,
		});
	}

	const { root, leaves } = buildDirectories(entries);
	const metadata = gzipSync(Buffer.from(JSON.stringify(details.metadata)));

	const rootOffset = HEADER_BYTES;
	const metadataOffset = rootOffset + root.length;
	const leafOffset = metadataOffset + metadata.length;
	const dataOffset = leafOffset + leaves.length;

	const header = Buffer.alloc(HEADER_BYTES);
	header.write("PMTiles", 0, "ascii");
	header.writeUInt8(3, 7);
	header.writeBigUInt64LE(BigInt(rootOffset), 8);
	header.writeBigUInt64LE(BigInt(root.length), 16);
	header.writeBigUInt64LE(BigInt(metadataOffset), 24);
	header.writeBigUInt64LE(BigInt(metadata.length), 32);
	header.writeBigUInt64LE(BigInt(leafOffset), 40);
	header.writeBigUInt64LE(BigInt(leaves.length), 48);
	header.writeBigUInt64LE(BigInt(dataOffset), 56);
	header.writeBigUInt64LE(BigInt(dataLength), 64);
	header.writeBigUInt64LE(
		BigInt(entries.reduce((total, entry) => total + entry.runLength, 0)),
		72,
	);
	header.writeBigUInt64LE(BigInt(entries.length), 80);
	header.writeBigUInt64LE(BigInt(storedAt.size), 88);
	header.writeUInt8(1, 96); // clustered: entries ascend by tile id
	header.writeUInt8(COMPRESSION_GZIP, 97);
	header.writeUInt8(COMPRESSION_GZIP, 98);
	header.writeUInt8(TILE_TYPE_MVT, 99);
	header.writeUInt8(details.minZoom, 100);
	header.writeUInt8(details.maxZoom, 101);
	header.writeInt32LE(e7(details.bounds[0]), 102);
	header.writeInt32LE(e7(details.bounds[1]), 106);
	header.writeInt32LE(e7(details.bounds[2]), 110);
	header.writeInt32LE(e7(details.bounds[3]), 114);
	header.writeUInt8(details.centre[2], 118);
	header.writeInt32LE(e7(details.centre[0]), 119);
	header.writeInt32LE(e7(details.centre[1]), 123);

	return Buffer.concat([header, root, metadata, leaves, ...blocks]);
};
