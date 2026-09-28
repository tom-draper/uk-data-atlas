import { gunzipSync } from "node:zlib";

/**
 * A PMTiles v3 reader, written from the specification rather than from the
 * writer it checks, so the two cannot agree on a misreading of the format.
 * It resolves a tile the way a client does: header, root directory, and a leaf
 * directory when the root points at one.
 */

export type ArchiveHeader = {
	magic: string;
	version: number;
	rootOffset: number;
	rootLength: number;
	metadataOffset: number;
	metadataLength: number;
	leafOffset: number;
	leafLength: number;
	dataOffset: number;
	dataLength: number;
	addressedTiles: number;
	tileEntries: number;
	tileContents: number;
	clustered: number;
	internalCompression: number;
	tileCompression: number;
	tileType: number;
	minZoom: number;
	maxZoom: number;
	bounds: [number, number, number, number];
	centre: [number, number, number];
};

const number = (buffer: Buffer, at: number) =>
	Number(buffer.readBigUInt64LE(at));

const degrees = (buffer: Buffer, at: number) => buffer.readInt32LE(at) / 1e7;

export const readHeader = (archive: Buffer): ArchiveHeader => ({
	magic: archive.subarray(0, 7).toString("ascii"),
	version: archive.readUInt8(7),
	rootOffset: number(archive, 8),
	rootLength: number(archive, 16),
	metadataOffset: number(archive, 24),
	metadataLength: number(archive, 32),
	leafOffset: number(archive, 40),
	leafLength: number(archive, 48),
	dataOffset: number(archive, 56),
	dataLength: number(archive, 64),
	addressedTiles: number(archive, 72),
	tileEntries: number(archive, 80),
	tileContents: number(archive, 88),
	clustered: archive.readUInt8(96),
	internalCompression: archive.readUInt8(97),
	tileCompression: archive.readUInt8(98),
	tileType: archive.readUInt8(99),
	minZoom: archive.readUInt8(100),
	maxZoom: archive.readUInt8(101),
	bounds: [
		degrees(archive, 102),
		degrees(archive, 106),
		degrees(archive, 110),
		degrees(archive, 114),
	],
	centre: [
		degrees(archive, 119),
		degrees(archive, 123),
		archive.readUInt8(118),
	],
});

type Entry = {
	tileId: number;
	offset: number;
	length: number;
	runLength: number;
};

const readDirectory = (block: Buffer): Entry[] => {
	let at = 0;
	const varint = () => {
		let value = 0;
		let shift = 1;
		for (;;) {
			const byte = block[at]!;
			at += 1;
			value += (byte & 0x7f) * shift;
			if ((byte & 0x80) === 0) return value;
			shift *= 128;
		}
	};
	const count = varint();
	const entries: Entry[] = Array.from({ length: count }, () => ({
		tileId: 0,
		offset: 0,
		length: 0,
		runLength: 0,
	}));
	let id = 0;
	for (const entry of entries) {
		id += varint();
		entry.tileId = id;
	}
	for (const entry of entries) entry.runLength = varint();
	for (const entry of entries) entry.length = varint();
	for (const [index, entry] of entries.entries()) {
		const value = varint();
		const previous = entries[index - 1];
		entry.offset =
			value === 0 && previous
				? previous.offset + previous.length
				: value - 1;
	}
	return entries;
};

export const readMetadata = (archive: Buffer) => {
	const header = readHeader(archive);
	return JSON.parse(
		gunzipSync(
			archive.subarray(
				header.metadataOffset,
				header.metadataOffset + header.metadataLength,
			),
		).toString("utf8"),
	) as Record<string, unknown>;
};

/** The tile's own bytes, or undefined when the archive does not hold it. */
export const readTile = (
	archive: Buffer,
	wanted: number,
): Buffer | undefined => {
	const header = readHeader(archive);
	let directory = readDirectory(
		gunzipSync(
			archive.subarray(
				header.rootOffset,
				header.rootOffset + header.rootLength,
			),
		),
	);
	for (let depth = 0; depth < 4; depth += 1) {
		// The entry covering this id is the last one starting at or before it.
		let found: Entry | undefined;
		for (const entry of directory) {
			if (entry.tileId > wanted) break;
			found = entry;
		}
		if (!found) return undefined;
		if (found.runLength === 0) {
			directory = readDirectory(
				gunzipSync(
					archive.subarray(
						header.leafOffset + found.offset,
						header.leafOffset + found.offset + found.length,
					),
				),
			);
			continue;
		}
		if (wanted >= found.tileId + found.runLength) return undefined;
		return gunzipSync(
			archive.subarray(
				header.dataOffset + found.offset,
				header.dataOffset + found.offset + found.length,
			),
		);
	}
	return undefined;
};
