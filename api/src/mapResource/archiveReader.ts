import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { tileId } from "./pmtiles";

/**
 * Reading tiles back out of a published archive, for the server to answer a
 * tile request from.
 *
 * The archive is held in memory and its directories are decoded once. It is a
 * few megabytes against the hundred the catalogues already occupy, and it
 * turns a tile request into a lookup rather than a file read.
 */

type Entry = {
	tileId: number;
	offset: number;
	length: number;
	/** How many consecutive ids the entry answers; 0 means it points at a leaf. */
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

/** The last entry starting at or before the wanted id, by bisection. */
const covering = (entries: Entry[], wanted: number) => {
	let low = 0;
	let high = entries.length - 1;
	let found: Entry | undefined;
	while (low <= high) {
		const middle = (low + high) >> 1;
		if (entries[middle]!.tileId <= wanted) {
			found = entries[middle];
			low = middle + 1;
		} else high = middle - 1;
	}
	return found;
};

export type MapArchive = {
	bytes: number;
	minZoom: number;
	maxZoom: number;
	/** The whole archive, for a caller downloading it rather than one tile. */
	archive: Buffer;
	/** One tile's bytes, still gzipped as the archive stores them. */
	tile: (z: number, x: number, y: number) => Buffer | undefined;
};

export const openArchive = (path: string): MapArchive => {
	const archive = readFileSync(path);
	if (archive.subarray(0, 7).toString("ascii") !== "PMTiles")
		throw new Error(`${path} is not a PMTiles archive.`);
	if (archive.readUInt8(7) !== 3)
		throw new Error(`${path} is not a version 3 PMTiles archive.`);
	const offset = (at: number) => Number(archive.readBigUInt64LE(at));
	const rootOffset = offset(8);
	const rootLength = offset(16);
	const leafOffset = offset(40);
	const dataOffset = offset(56);
	const minZoom = archive.readUInt8(100);
	const maxZoom = archive.readUInt8(101);

	const root = readDirectory(
		gunzipSync(archive.subarray(rootOffset, rootOffset + rootLength)),
	);
	const leaves = new Map<number, Entry[]>();

	const tile = (z: number, x: number, y: number) => {
		if (z < minZoom || z > maxZoom) return undefined;
		let wanted: number;
		try {
			wanted = tileId(z, x, y);
		} catch {
			return undefined;
		}
		let entries = root;
		// A root entry may point at a leaf directory, which may not point at
		// another: two levels is all the archive is ever built with.
		for (let depth = 0; depth < 3; depth += 1) {
			const found = covering(entries, wanted);
			if (!found) return undefined;
			if (found.runLength > 0)
				return wanted < found.tileId + found.runLength
					? archive.subarray(
							dataOffset + found.offset,
							dataOffset + found.offset + found.length,
						)
					: undefined;
			let leaf = leaves.get(found.offset);
			if (!leaf) {
				leaf = readDirectory(
					gunzipSync(
						archive.subarray(
							leafOffset + found.offset,
							leafOffset + found.offset + found.length,
						),
					),
				);
				leaves.set(found.offset, leaf);
			}
			entries = leaf;
		}
		return undefined;
	};

	return { bytes: archive.length, minZoom, maxZoom, archive, tile };
};
