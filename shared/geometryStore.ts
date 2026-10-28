import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import type { GeometryBounds } from "./areaContainment";
import type { GeoJsonGeometry, GeometrySource } from "./areaGeometry";
import {
	compareSpatialCells,
	spatialCells,
	type SpatialCell,
} from "./geometrySpatialIndex";
import {
	DEGREE_SCALE,
	packedBounds,
	roundDegrees,
	type PackedGeometry,
} from "./packedGeometry";
import {
	GEOMETRY_VALIDITY_METHOD,
	uncompiledGeometryValidity,
	type GeometryValidityReport,
} from "@uk-data-atlas/geography";

/**
 * A compiled release keeps only metadata in memory: area codes, envelopes,
 * byte ranges and the spatial grid. Individual geometry records stay on disk
 * until a route needs them.
 *
 * Layout, little-endian, tables aligned to eight bytes:
 *
 *   "ATLGEO3\n"
 *   u32 header length, u32 area count
 *   header JSON: { source, codes, spatialIndex counts, validityMethod }
 *   f64 offsets[count + 1]
 *   f64 bounds[count * 4]
 *   i32 cells[cellCount * 2]: longitude, latitude
 *   u32 cellOffsets[cellCount + 1]
 *   u32 cellCandidates[candidateCount]
 *   u32 indexedCodes[indexedCodeCount]
 *   area records
 *
 * A record is a u32 descriptor length, the descriptor JSON (its shape and
 * validity, which is read on its own), then its arrays. Coordinates are held
 * to seven decimal places (see `roundDegrees`), so most are stored as each
 * position's step from the one before, in units of 1e-7, as zigzag varints:
 * neighbouring vertices are close, so most steps take one to three bytes.
 * Positions not on that grid are kept as f64. Counts are varints too.
 * Plain varints decode faster than a compressed frame per record, which
 * costs more to set up than small areas take to read.
 */

const MAGIC = Buffer.from("ATLGEO3\n");

type Descriptor =
	/** `q` marks positions held as steps rather than f64. */
	| { k: "p"; t: string; s: number; n: number; c: number[]; q?: 1 }
	| { k: "c"; g: Descriptor[] }
	| { k: "r"; g: GeoJsonGeometry };

type SpatialIndexHeader = {
	cellCount: number;
	candidateCount: number;
	indexedCodeCount: number;
};

type StoreHeader = {
	source: GeometrySource;
	codes: string[];
	spatialIndex: SpatialIndexHeader;
	/** Shared by every record's validity report, so stored once. */
	validityMethod: GeometryValidityReport["method"];
};

const align = (offset: number) => Math.ceil(offset / 8) * 8;

/** Bytes appended through `varint` and `bytes`, grown as needed. */
class ByteWriter {
	buffer = Buffer.allocUnsafe(1024);
	length = 0;
	private reserve(bytes: number) {
		if (this.length + bytes <= this.buffer.length) return;
		const next = Buffer.allocUnsafe(
			Math.max(this.buffer.length * 2, this.length + bytes),
		);
		this.buffer.copy(next, 0, 0, this.length);
		this.buffer = next;
	}
	/** A non-negative integer below 2^53, seven bits a byte. */
	varint(value: number) {
		this.reserve(8);
		while (value >= 0x80) {
			this.buffer[this.length++] = (value % 0x80) | 0x80;
			value = Math.floor(value / 0x80);
		}
		this.buffer[this.length++] = value;
	}
	bytes(block: Uint8Array) {
		this.reserve(block.length);
		this.buffer.set(block, this.length);
		this.length += block.length;
	}
}

const onGrid = (positions: Float64Array) => {
	for (const value of positions)
		if (roundDegrees(value) !== value) return false;
	return true;
};

/** Each position's step from the one `stride` before, zigzag encoded. */
const writeSteps = (
	writer: ByteWriter,
	positions: Float64Array,
	stride: number,
) => {
	for (let at = 0; at < positions.length; at++) {
		const units = Math.round(positions[at]! * DEGREE_SCALE);
		const step =
			at < stride
				? units
				: units - Math.round(positions[at - stride]! * DEGREE_SCALE);
		writer.varint(step < 0 ? -2 * step - 1 : 2 * step);
	}
};

const encodeParts = (
	packed: PackedGeometry,
	writer: ByteWriter,
): Descriptor => {
	if (packed.kind === "collection")
		return {
			k: "c",
			g: packed.geometries.map((part) => encodeParts(part, writer)),
		};
	if (packed.kind === "raw") return { k: "r", g: packed.geometry };
	const steps = onGrid(packed.positions);
	if (steps) writeSteps(writer, packed.positions, packed.stride);
	else
		writer.bytes(
			new Uint8Array(
				packed.positions.buffer,
				packed.positions.byteOffset,
				packed.positions.byteLength,
			),
		);
	for (const level of packed.counts)
		for (const count of level) writer.varint(count);
	return {
		k: "p",
		t: packed.type,
		s: packed.stride,
		n: packed.positions.length,
		c: packed.counts.map((level) => level.length),
		...(steps ? { q: 1 as const } : {}),
	};
};

const encodeArea = (
	packed: PackedGeometry,
	validity?: GeometryValidityReport,
): Buffer[] => {
	const writer = new ByteWriter();
	const shape = encodeParts(packed, writer);
	let report: Omit<GeometryValidityReport, "method"> | undefined;
	if (validity) {
		const { method, ...rest } = validity;
		if (JSON.stringify(method) !== JSON.stringify(GEOMETRY_VALIDITY_METHOD))
			throw new Error("A validity report was made by another method.");
		report = rest;
	}
	const descriptor = Buffer.from(
		JSON.stringify({ ...shape, ...(report ? { validity: report } : {}) }),
	);
	const length = Buffer.alloc(4);
	length.writeUInt32LE(descriptor.length);
	return [length, descriptor, writer.buffer.subarray(0, writer.length)];
};

/** Reads one record's arrays, in the order `encodeParts` wrote them. */
class RecordReader {
	constructor(
		private readonly record: Buffer,
		private cursor: number,
		private readonly path: string,
	) {}

	private truncated() {
		return new Error(`${this.path} has a truncated area record.`);
	}

	private varint() {
		const record = this.record;
		if (this.cursor >= record.length) throw this.truncated();
		let byte = record[this.cursor++]!;
		if (byte < 0x80) return byte;
		let value = byte & 0x7f;
		let scale = 0x80;
		do {
			if (this.cursor >= record.length) throw this.truncated();
			byte = record[this.cursor++]!;
			value += (byte & 0x7f) * scale;
			scale *= 0x80;
		} while (byte >= 0x80);
		return value;
	}

	private positions(length: number, stride: number, steps: boolean) {
		const values = new Float64Array(length);
		if (!steps) {
			const end = this.cursor + length * 8;
			if (end > this.record.length) throw this.truncated();
			// Copied, so the array owns aligned memory of its own.
			new Uint8Array(values.buffer).set(
				this.record.subarray(this.cursor, end),
			);
			this.cursor = end;
			return values;
		}
		const units = new Float64Array(stride);
		for (let at = 0; at < length; at++) {
			const zigzag = this.varint();
			const axis = at % stride;
			units[axis] += zigzag % 2 ? -(zigzag + 1) / 2 : zigzag / 2;
			values[at] = units[axis]! / DEGREE_SCALE;
		}
		return values;
	}

	private counts(length: number) {
		const values = new Uint32Array(length);
		for (let at = 0; at < length; at++) values[at] = this.varint();
		return values;
	}

	read(part: Descriptor): PackedGeometry {
		if (part.k === "c")
			return {
				kind: "collection",
				geometries: part.g.map((child) => this.read(child)),
			};
		if (part.k === "r") return { kind: "raw", geometry: part.g };
		const positions = this.positions(part.n, part.s, part.q === 1);
		const counts: Uint32Array[] = [];
		for (const length of part.c) counts.push(this.counts(length));
		return {
			kind: "packed",
			type: part.t,
			stride: part.s,
			positions,
			counts,
		};
	}
}

type BuiltSpatialIndex = {
	cells: Array<{ cell: SpatialCell; candidates: number[] }>;
	indexedCodes: number[];
};

const buildSpatialIndex = (
	bounds: Array<GeometryBounds | undefined>,
): BuiltSpatialIndex => {
	const byCell = new Map<
		string,
		{ cell: SpatialCell; candidates: number[] }
	>();
	const indexedCodes: number[] = [];
	for (const [index, box] of bounds.entries()) {
		if (!box) continue;
		indexedCodes.push(index);
		for (const cell of spatialCells(box) ?? []) {
			const key = `${cell[0]}/${cell[1]}`;
			const entry = byCell.get(key) ?? { cell, candidates: [] };
			entry.candidates.push(index);
			byCell.set(key, entry);
		}
	}
	return {
		cells: [...byCell.values()].sort((left, right) =>
			compareSpatialCells(left.cell, right.cell),
		),
		indexedCodes,
	};
};

/** A release's areas, in the order its source lists them, as one file. */
export const encodeGeometryStore = (
	source: GeometrySource,
	areas: Iterable<readonly [string, PackedGeometry]>,
	validate?: (packed: PackedGeometry) => GeometryValidityReport,
): Buffer => {
	const codes: string[] = [];
	const records: Buffer[][] = [];
	const bounds: Array<GeometryBounds | undefined> = [];
	for (const [code, packed] of areas) {
		codes.push(code);
		records.push(encodeArea(packed, validate?.(packed)));
		bounds.push(packedBounds(packed));
	}
	const spatialIndex = buildSpatialIndex(bounds);
	const candidateCount = spatialIndex.cells.reduce(
		(total, cell) => total + cell.candidates.length,
		0,
	);
	const headerValue: StoreHeader = {
		source,
		codes,
		spatialIndex: {
			cellCount: spatialIndex.cells.length,
			candidateCount,
			indexedCodeCount: spatialIndex.indexedCodes.length,
		},
		validityMethod: GEOMETRY_VALIDITY_METHOD,
	};
	const header = Buffer.from(JSON.stringify(headerValue));
	const prefix = Buffer.alloc(8);
	prefix.writeUInt32LE(header.length, 0);
	prefix.writeUInt32LE(codes.length, 4);
	const tablesAt = align(MAGIC.length + prefix.length + header.length);
	const offsets = new Float64Array(codes.length + 1);
	const envelopes = new Float64Array(codes.length * 4).fill(Number.NaN);
	const cells = new Int32Array(spatialIndex.cells.length * 2);
	const cellOffsets = new Uint32Array(spatialIndex.cells.length + 1);
	const candidates = new Uint32Array(candidateCount);
	const indexedCodes = Uint32Array.from(spatialIndex.indexedCodes);
	let candidateAt = 0;
	for (const [index, entry] of spatialIndex.cells.entries()) {
		cells.set(entry.cell, index * 2);
		cellOffsets[index] = candidateAt;
		candidates.set(entry.candidates, candidateAt);
		candidateAt += entry.candidates.length;
	}
	cellOffsets[spatialIndex.cells.length] = candidateAt;
	const tableParts = [
		Buffer.from(offsets.buffer),
		Buffer.from(envelopes.buffer),
		Buffer.from(cells.buffer),
		Buffer.from(cellOffsets.buffer),
		Buffer.from(candidates.buffer),
		Buffer.from(indexedCodes.buffer),
	];
	const tablesBytes = tableParts.reduce(
		(total, part) => total + part.length,
		0,
	);
	const recordsAt = align(tablesAt + tablesBytes);
	let at = recordsAt;
	records.forEach((parts, index) => {
		offsets[index] = at;
		at += parts.reduce((sum, part) => sum + part.length, 0);
		const box = bounds[index];
		if (box) envelopes.set(box, index * 4);
	});
	offsets[codes.length] = at;
	// Offsets were filled after tableParts was made, so replace its first table.
	tableParts[0] = Buffer.from(offsets.buffer);
	return Buffer.concat([
		MAGIC,
		prefix,
		header,
		Buffer.alloc(tablesAt - (MAGIC.length + prefix.length + header.length)),
		...tableParts,
		Buffer.alloc(recordsAt - (tablesAt + tablesBytes)),
		...records.flat(),
	]);
};

export type StoredSpatialIndex = {
	codes: string[];
	cellCount: number;
	candidates(bounds: GeometryBounds): Iterable<string>;
};

export type StoredRelease = {
	codes: string[];
	has(code: string): boolean;
	get(code: string): PackedGeometry | undefined;
	validity(code: string): GeometryValidityReport | undefined;
	bounds(code: string): GeometryBounds | undefined;
	spatialIndex: StoredSpatialIndex;
	bytes: number;
	close(): void;
};

const sameSource = (left: GeometrySource, right: GeometrySource) =>
	JSON.stringify(left) === JSON.stringify(right);

const readAt = (descriptor: number, position: number, length: number) => {
	const content = Buffer.alloc(length);
	let read = 0;
	while (read < length) {
		const count = readSync(
			descriptor,
			content,
			read,
			length - read,
			position + read,
		);
		if (count === 0)
			throw new Error("Compiled geometry store ends unexpectedly.");
		read += count;
	}
	return content;
};

const tableLength = (count: number, index: SpatialIndexHeader) =>
	(count + 1) * Float64Array.BYTES_PER_ELEMENT +
	count * 4 * Float64Array.BYTES_PER_ELEMENT +
	index.cellCount * 2 * Int32Array.BYTES_PER_ELEMENT +
	(index.cellCount + 1) * Uint32Array.BYTES_PER_ELEMENT +
	index.candidateCount * Uint32Array.BYTES_PER_ELEMENT +
	index.indexedCodeCount * Uint32Array.BYTES_PER_ELEMENT;

const validSpatialIndex = (index: SpatialIndexHeader) =>
	Number.isSafeInteger(index.cellCount) &&
	Number.isSafeInteger(index.candidateCount) &&
	Number.isSafeInteger(index.indexedCodeCount) &&
	index.cellCount >= 0 &&
	index.candidateCount >= 0 &&
	index.indexedCodeCount >= 0;

/**
 * Opens a compiled release, or returns undefined when it was compiled from a
 * different source. Only its metadata is read now; each geometry is read by
 * the byte range recorded for it.
 */
export const readGeometryStore = (
	path: string,
	expected: GeometrySource,
): StoredRelease | undefined => {
	const descriptor = openSync(path, "r");
	let closed = false;
	const close = () => {
		if (!closed) {
			closeSync(descriptor);
			closed = true;
		}
	};
	try {
		const prefix = readAt(descriptor, 0, MAGIC.length + 8);
		if (!prefix.subarray(0, MAGIC.length).equals(MAGIC))
			throw new Error(`${path} is not a compiled geometry release.`);
		const headerLength = prefix.readUInt32LE(MAGIC.length);
		const count = prefix.readUInt32LE(MAGIC.length + 4);
		const headerAt = MAGIC.length + 8;
		const header = JSON.parse(
			readAt(descriptor, headerAt, headerLength).toString("utf8"),
		) as StoreHeader;
		if (!sameSource(header.source, expected)) {
			close();
			return undefined;
		}
		if (
			header.codes.length !== count ||
			!validSpatialIndex(header.spatialIndex)
		)
			throw new Error(`${path} has invalid compiled geometry metadata.`);
		const tablesAt = align(headerAt + headerLength);
		const tablesBytes = tableLength(count, header.spatialIndex);
		const recordsAt = align(tablesAt + tablesBytes);
		const bytes = fstatSync(descriptor).size;
		if (recordsAt > bytes)
			throw new Error(`${path} ends before its geometry records.`);
		let tables = readAt(descriptor, tablesAt, tablesBytes);
		if (tables.byteOffset % 8 !== 0) tables = Buffer.from(tables);
		let offset = 0;
		const offsets = new Float64Array(
			tables.buffer,
			tables.byteOffset + offset,
			count + 1,
		);
		offset += offsets.byteLength;
		const envelopes = new Float64Array(
			tables.buffer,
			tables.byteOffset + offset,
			count * 4,
		);
		offset += envelopes.byteLength;
		const cells = new Int32Array(
			tables.buffer,
			tables.byteOffset + offset,
			header.spatialIndex.cellCount * 2,
		);
		offset += cells.byteLength;
		const cellOffsets = new Uint32Array(
			tables.buffer,
			tables.byteOffset + offset,
			header.spatialIndex.cellCount + 1,
		);
		offset += cellOffsets.byteLength;
		const candidates = new Uint32Array(
			tables.buffer,
			tables.byteOffset + offset,
			header.spatialIndex.candidateCount,
		);
		offset += candidates.byteLength;
		const indexedCodes = new Uint32Array(
			tables.buffer,
			tables.byteOffset + offset,
			header.spatialIndex.indexedCodeCount,
		);
		const index = new Map(header.codes.map((code, at) => [code, at]));
		for (let at = 0; at <= count; at++)
			if (
				!Number.isSafeInteger(offsets[at]!) ||
				offsets[at]! < recordsAt ||
				(at > 0 && offsets[at]! < offsets[at - 1]!)
			)
				throw new Error(
					`${path} has invalid compiled geometry offsets.`,
				);
		if (
			offsets[0] !== recordsAt ||
			offsets[count] !== bytes ||
			cellOffsets[0] !== 0 ||
			cellOffsets[cellOffsets.length - 1] !== candidates.length
		)
			throw new Error(`${path} has invalid compiled geometry indexes.`);
		for (const at of [...candidates, ...indexedCodes])
			if (at >= count)
				throw new Error(
					`${path} has invalid compiled geometry indexes.`,
				);
		const codeAt = (at: number) => header.codes[at];
		const findCell = ([longitude, latitude]: SpatialCell) => {
			let low = 0;
			let high = header.spatialIndex.cellCount - 1;
			while (low <= high) {
				const middle = Math.floor((low + high) / 2);
				const compared =
					cells[middle * 2]! - longitude ||
					cells[middle * 2 + 1]! - latitude;
				if (compared === 0) return middle;
				if (compared < 0) low = middle + 1;
				else high = middle - 1;
			}
			return undefined;
		};
		const decode = (at: number): PackedGeometry => {
			const start = offsets[at]!;
			const end = offsets[at + 1]!;
			const record = readAt(descriptor, start, end - start);
			const descriptorLength = record.readUInt32LE(0);
			if (descriptorLength > record.length - 4)
				throw new Error(`${path} has an invalid area descriptor.`);
			const area = JSON.parse(
				record.toString("utf8", 4, 4 + descriptorLength),
			) as Descriptor;
			return new RecordReader(record, 4 + descriptorLength, path).read(
				area,
			);
		};
		return {
			codes: header.codes,
			has: (code) => index.has(code),
			get: (code) => {
				const at = index.get(code);
				return at === undefined ? undefined : decode(at);
			},
			validity: (code) => {
				const at = index.get(code);
				if (at === undefined) return undefined;
				const start = offsets[at]!;
				const length = readAt(descriptor, start, 4).readUInt32LE(0);
				if (length > offsets[at + 1]! - start - 4)
					throw new Error(`${path} has an invalid area descriptor.`);
				const area = JSON.parse(
					readAt(descriptor, start + 4, length).toString("utf8"),
				) as {
					validity?: Omit<GeometryValidityReport, "method">;
				};
				return area.validity
					? ({
							method: header.validityMethod,
							...area.validity,
						} as GeometryValidityReport)
					: uncompiledGeometryValidity;
			},
			bounds: (code) => {
				const at = index.get(code);
				if (at === undefined || Number.isNaN(envelopes[at * 4]!))
					return undefined;
				return [
					envelopes[at * 4]!,
					envelopes[at * 4 + 1]!,
					envelopes[at * 4 + 2]!,
					envelopes[at * 4 + 3]!,
				] as GeometryBounds;
			},
			spatialIndex: {
				codes: [...indexedCodes].map((at) => codeAt(at)!),
				cellCount: header.spatialIndex.cellCount,
				candidates: (bounds) => {
					const queryCells = spatialCells(bounds);
					if (queryCells === undefined)
						return [...indexedCodes].map((at) => codeAt(at)!);
					const found = new Set<number>();
					for (const cell of queryCells) {
						const at = findCell(cell);
						if (at === undefined) continue;
						for (
							let candidate = cellOffsets[at]!;
							candidate < cellOffsets[at + 1]!;
							candidate++
						)
							found.add(candidates[candidate]!);
					}
					return [...found].map((at) => codeAt(at)!);
				},
			},
			bytes,
			close,
		};
	} catch (error) {
		close();
		throw error;
	}
};
