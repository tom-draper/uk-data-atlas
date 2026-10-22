import { varint } from "./varint";

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

/**
 * Gzip, as the consumer provides it: `zlib.gzipSync` under Node. Passed in so
 * this package stays free of Node built-ins.
 */
export type Gzip = (bytes: Uint8Array) => Uint8Array;

const concat = (parts: readonly Uint8Array[]) => {
	const joined = new Uint8Array(
		parts.reduce((total, part) => total + part.length, 0),
	);
	let at = 0;
	for (const part of parts) {
		joined.set(part, at);
		at += part.length;
	}
	return joined;
};

/** A string standing for some bytes, to find tiles stored already. */
const bytesKey = (bytes: Uint8Array) => {
	let key = "";
	for (let at = 0; at < bytes.length; at += 8192)
		key += String.fromCharCode(...bytes.subarray(at, at + 8192));
	return key;
};
const ROOT_DIRECTORY_TARGET = 16384;

export const TILE_TYPE_MVT = 1;
const COMPRESSION_GZIP = 2;

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
	return Uint8Array.from(bytes);
};

/**
 * Fit the directory into a root a reader can fetch in one request, moving the
 * entries into leaf directories and doubling how many go in each until the
 * root that points at them is small enough.
 */
const buildDirectories = (entries: Entry[], gzip: Gzip) => {
	const root = serialiseDirectory(entries);
	const compressed = gzip(root);
	if (compressed.length <= ROOT_DIRECTORY_TARGET)
		return { root: compressed, leaves: new Uint8Array(0) };
	for (let perLeaf = 4096; ; perLeaf *= 2) {
		const rootEntries: Entry[] = [];
		const blocks: Uint8Array[] = [];
		let offset = 0;
		for (let at = 0; at < entries.length; at += perLeaf) {
			const group = entries.slice(at, at + perLeaf);
			const leaf = gzip(serialiseDirectory(group));
			blocks.push(leaf);
			rootEntries.push({
				tileId: group[0]!.tileId,
				offset,
				length: leaf.length,
				runLength: 0,
			});
			offset += leaf.length;
		}
		const packed = gzip(serialiseDirectory(rootEntries));
		if (packed.length <= ROOT_DIRECTORY_TARGET || rootEntries.length === 1)
			return { root: packed, leaves: concat(blocks) };
	}
};

export type ArchiveTile = {
	z: number;
	x: number;
	y: number;
	body: Uint8Array;
};

export type ArchiveDetails = {
	minZoom: number;
	maxZoom: number;
	/** Degrees, as the archive advertises its coverage. */
	bounds: [west: number, south: number, east: number, north: number];
	centre: [longitude: number, latitude: number, zoom: number];
	metadata: Record<string, unknown>;
	gzip: Gzip;
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
): Uint8Array => {
	const ordered = tiles
		.map((tile) => ({
			id: tileId(tile.z, tile.x, tile.y),
			body: tile.body,
		}))
		.sort((left, right) => left.id - right.id);

	const blocks: Uint8Array[] = [];
	const storedAt = new Map<string, { offset: number; length: number }>();
	const entries: Entry[] = [];
	let dataLength = 0;
	for (const tile of ordered) {
		const body = details.gzip(tile.body);
		const key = bytesKey(body);
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

	const { root, leaves } = buildDirectories(entries, details.gzip);
	const metadata = details.gzip(
		new TextEncoder().encode(JSON.stringify(details.metadata)),
	);

	const rootOffset = HEADER_BYTES;
	const metadataOffset = rootOffset + root.length;
	const leafOffset = metadataOffset + metadata.length;
	const dataOffset = leafOffset + leaves.length;

	const header = new Uint8Array(HEADER_BYTES);
	header.set(new TextEncoder().encode("PMTiles"), 0);
	const view = new DataView(header.buffer);
	view.setUint8(7, 3);
	view.setBigUint64(8, BigInt(rootOffset), true);
	view.setBigUint64(16, BigInt(root.length), true);
	view.setBigUint64(24, BigInt(metadataOffset), true);
	view.setBigUint64(32, BigInt(metadata.length), true);
	view.setBigUint64(40, BigInt(leafOffset), true);
	view.setBigUint64(48, BigInt(leaves.length), true);
	view.setBigUint64(56, BigInt(dataOffset), true);
	view.setBigUint64(64, BigInt(dataLength), true);
	view.setBigUint64(
		72,
		BigInt(entries.reduce((total, entry) => total + entry.runLength, 0)),
		true,
	);
	view.setBigUint64(80, BigInt(entries.length), true);
	view.setBigUint64(88, BigInt(storedAt.size), true);
	view.setUint8(96, 1); // clustered: entries ascend by tile id
	view.setUint8(97, COMPRESSION_GZIP);
	view.setUint8(98, COMPRESSION_GZIP);
	view.setUint8(99, TILE_TYPE_MVT);
	view.setUint8(100, details.minZoom);
	view.setUint8(101, details.maxZoom);
	view.setInt32(102, e7(details.bounds[0]), true);
	view.setInt32(106, e7(details.bounds[1]), true);
	view.setInt32(110, e7(details.bounds[2]), true);
	view.setInt32(114, e7(details.bounds[3]), true);
	view.setUint8(118, details.centre[2]);
	view.setInt32(119, e7(details.centre[0]), true);
	view.setInt32(123, e7(details.centre[1]), true);

	return concat([header, root, metadata, leaves, ...blocks]);
};
