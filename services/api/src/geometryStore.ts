import { readFileSync } from "node:fs";
import type { GeometryBounds } from "./areaContainment";
import type { GeoJsonGeometry, GeometrySource } from "./areaGeometry";
import { packedBounds, type PackedGeometry } from "./packedGeometry";

/**
 * One boundary release's areas compiled for serving: already in WGS84, with
 * every declared correction, substitution and reversed offset applied, and
 * with each area's envelope worked out.
 *
 * Reading a release from its publisher's file means parsing the whole of it
 * as JSON and reprojecting every area, which for the 2021 output areas takes
 * the server's one thread for over ten seconds. A compiled release is read
 * as it is stored: its numbers are used where they lie in the file, and an
 * area is only decoded when something asks for it.
 *
 * Layout, little-endian, every array aligned to eight bytes from the start
 * of the file:
 *
 *   "ATLGEO1\n"
 *   u32 header length, u32 area count
 *   header JSON: { source, codes }
 *   f64 offsets[count + 1]: where each area's record starts, then the end
 *   f64 bounds[count * 4]: west, south, east, north; NaN when it has none
 *   area records
 *
 * An area record is a u32 descriptor length, the descriptor as JSON, then
 * the arrays the descriptor lists, in its order.
 */

const MAGIC = Buffer.from("ATLGEO1\n");

type Descriptor =
	| {
			k: "p";
			t: string;
			s: number;
			/** Numbers in the positions array. */
			n: number;
			/** Length of each counts array, outermost first. */
			c: number[];
	  }
	| { k: "c"; g: Descriptor[] }
	| { k: "r"; g: GeoJsonGeometry };

const align = (offset: number) => Math.ceil(offset / 8) * 8;

const describe = (packed: PackedGeometry): Descriptor =>
	packed.kind === "packed"
		? {
				k: "p",
				t: packed.type,
				s: packed.stride,
				n: packed.positions.length,
				c: packed.counts.map((level) => level.length),
			}
		: packed.kind === "collection"
			? { k: "c", g: packed.geometries.map(describe) }
			: { k: "r", g: packed.geometry };

/** The typed arrays an area holds, in the order its descriptor lists them. */
const arraysOf = (packed: PackedGeometry): Array<Float64Array | Uint32Array> =>
	packed.kind === "packed"
		? [packed.positions, ...packed.counts]
		: packed.kind === "collection"
			? packed.geometries.flatMap(arraysOf)
			: [];

const encodeArea = (packed: PackedGeometry): Buffer[] => {
	const descriptor = Buffer.from(JSON.stringify(describe(packed)));
	const length = Buffer.alloc(4);
	length.writeUInt32LE(descriptor.length);
	const parts: Buffer[] = [length, descriptor];
	let size = 4 + descriptor.length;
	for (const array of arraysOf(packed)) {
		const padding = align(size) - size;
		if (padding) parts.push(Buffer.alloc(padding));
		size += padding;
		const bytes = Buffer.from(
			array.buffer,
			array.byteOffset,
			array.byteLength,
		);
		parts.push(bytes);
		size += bytes.length;
	}
	const padding = align(size) - size;
	if (padding) parts.push(Buffer.alloc(padding));
	return parts;
};

/** A release's areas, in the order its source lists them, as one file. */
export const encodeGeometryStore = (
	source: GeometrySource,
	areas: Iterable<readonly [string, PackedGeometry]>,
): Buffer => {
	const codes: string[] = [];
	const records: Buffer[][] = [];
	const bounds: Array<GeometryBounds | undefined> = [];
	for (const [code, packed] of areas) {
		codes.push(code);
		records.push(encodeArea(packed));
		bounds.push(packedBounds(packed));
	}
	const header = Buffer.from(JSON.stringify({ source, codes }));
	const prefix = Buffer.alloc(8);
	prefix.writeUInt32LE(header.length, 0);
	prefix.writeUInt32LE(codes.length, 4);
	const tablesAt = align(MAGIC.length + prefix.length + header.length);
	const offsets = new Float64Array(codes.length + 1);
	const envelopes = new Float64Array(codes.length * 4).fill(Number.NaN);
	let at = tablesAt + offsets.byteLength + envelopes.byteLength;
	records.forEach((parts, index) => {
		offsets[index] = at;
		at += parts.reduce((sum, part) => sum + part.length, 0);
		const box = bounds[index];
		if (box) envelopes.set(box, index * 4);
	});
	offsets[codes.length] = at;
	return Buffer.concat([
		MAGIC,
		prefix,
		header,
		Buffer.alloc(tablesAt - (MAGIC.length + prefix.length + header.length)),
		Buffer.from(offsets.buffer),
		Buffer.from(envelopes.buffer),
		...records.flat(),
	]);
};

export type StoredRelease = {
	/** Every area code, in the order the source lists them. */
	codes: string[];
	has(code: string): boolean;
	/** One area, decoded from the file; its numbers are not copied. */
	get(code: string): PackedGeometry | undefined;
	bounds(code: string): GeometryBounds | undefined;
	/** The size of the file held. */
	bytes: number;
};

const sameSource = (left: GeometrySource, right: GeometrySource) =>
	JSON.stringify(left) === JSON.stringify(right);

/**
 * Opens a compiled release, or returns undefined when the file was compiled
 * from a different source than the one now registered, so a stale file is
 * never served in its place.
 */
export const readGeometryStore = (
	path: string,
	expected: GeometrySource,
): StoredRelease | undefined => {
	let file = readFileSync(path);
	// Typed arrays over the file need it to start on an eight-byte boundary.
	if (file.byteOffset % 8 !== 0) file = Buffer.from(file);
	if (!file.subarray(0, MAGIC.length).equals(MAGIC))
		throw new Error(`${path} is not a compiled geometry release.`);
	const headerLength = file.readUInt32LE(MAGIC.length);
	const count = file.readUInt32LE(MAGIC.length + 4);
	const headerAt = MAGIC.length + 8;
	const header = JSON.parse(
		file.toString("utf8", headerAt, headerAt + headerLength),
	) as { source: GeometrySource; codes: string[] };
	if (!sameSource(header.source, expected)) return undefined;
	if (header.codes.length !== count)
		throw new Error(
			`${path} lists ${header.codes.length} of ${count} areas.`,
		);
	const tablesAt = align(headerAt + headerLength);
	const offsets = new Float64Array(
		file.buffer,
		file.byteOffset + tablesAt,
		count + 1,
	);
	const envelopes = new Float64Array(
		file.buffer,
		file.byteOffset + tablesAt + offsets.byteLength,
		count * 4,
	);
	const index = new Map(header.codes.map((code, at) => [code, at]));

	const decode = (at: number): PackedGeometry => {
		const start = offsets[at]!;
		const descriptorLength = file.readUInt32LE(start);
		const descriptor = JSON.parse(
			file.toString("utf8", start + 4, start + 4 + descriptorLength),
		) as Descriptor;
		let cursor = start + 4 + descriptorLength;
		const float64 = (length: number) => {
			cursor = align(cursor);
			const array = new Float64Array(
				file.buffer,
				file.byteOffset + cursor,
				length,
			);
			cursor += array.byteLength;
			return array;
		};
		const uint32 = (length: number) => {
			cursor = align(cursor);
			const array = new Uint32Array(
				file.buffer,
				file.byteOffset + cursor,
				length,
			);
			cursor += array.byteLength;
			return array;
		};
		const build = (part: Descriptor): PackedGeometry =>
			part.k === "p"
				? {
						kind: "packed",
						type: part.t,
						stride: part.s,
						positions: float64(part.n),
						counts: part.c.map(uint32),
					}
				: part.k === "c"
					? { kind: "collection", geometries: part.g.map(build) }
					: { kind: "raw", geometry: part.g };
		return build(descriptor);
	};

	return {
		codes: header.codes,
		has: (code) => index.has(code),
		get: (code) => {
			const at = index.get(code);
			return at === undefined ? undefined : decode(at);
		},
		bounds: (code) => {
			const at = index.get(code);
			if (at === undefined || Number.isNaN(envelopes[at * 4]!))
				return undefined;
			return Array.from(
				envelopes.subarray(at * 4, at * 4 + 4),
			) as GeometryBounds;
		},
		bytes: file.length,
	};
};
