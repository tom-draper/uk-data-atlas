import { gunzipSync } from "node:zlib";

/**
 * A Parquet reader, written from the format specification rather than from the
 * writer it checks, so the two cannot agree on a misreading of the format. It
 * decodes the footer with a general Thrift compact decoder that knows nothing
 * of which fields the writer emits, and reads values back through the schema
 * tree the way a reader must: leaf columns in depth-first order, definition
 * levels from each leaf's repetition, and the RLE/bit-packing hybrid in both
 * of its run forms.
 */

/** A decoded Thrift struct: field id to value. */
export type ThriftStruct = Map<number, ThriftValue>;
type ThriftValue = boolean | bigint | Buffer | ThriftStruct | ThriftValue[];

class CompactReader {
	at = 0;
	constructor(private readonly bytes: Buffer) {}

	byte() {
		return this.bytes[this.at++]!;
	}

	varint(): bigint {
		let result = 0n;
		let shift = 0n;
		for (;;) {
			const byte = this.byte();
			result |= BigInt(byte & 0x7f) << shift;
			if ((byte & 0x80) === 0) return result;
			shift += 7n;
		}
	}

	zigzag(): bigint {
		const raw = this.varint();
		return (raw >> 1n) ^ -(raw & 1n);
	}

	value(type: number): ThriftValue {
		switch (type) {
			case 1:
				return true;
			case 2:
				return false;
			case 3:
				return BigInt(this.byte());
			case 4:
			case 5:
			case 6:
				return this.zigzag();
			case 7: {
				const at = this.at;
				this.at += 8;
				return this.bytes.subarray(at, at + 8);
			}
			case 8: {
				const length = Number(this.varint());
				const at = this.at;
				this.at += length;
				return this.bytes.subarray(at, at + length);
			}
			case 9:
			case 10: {
				const header = this.byte();
				let size = header >> 4;
				if (size === 15) size = Number(this.varint());
				const elementType = header & 0x0f;
				// Booleans inside a list are a whole byte each.
				return Array.from({ length: size }, () =>
					elementType === 1 || elementType === 2
						? this.byte() === 1
						: this.value(elementType),
				);
			}
			case 12:
				return this.struct();
			default:
				throw new Error(`Unsupported Thrift compact type ${type}.`);
		}
	}

	struct(): ThriftStruct {
		const fields: ThriftStruct = new Map();
		let last = 0;
		for (;;) {
			const header = this.byte();
			if (header === 0) return fields;
			const delta = header >> 4;
			const type = header & 0x0f;
			const id = delta === 0 ? Number(this.zigzag()) : last + delta;
			last = id;
			fields.set(id, this.value(type));
		}
	}
}

const int = (struct: ThriftStruct, id: number) => {
	const value = struct.get(id);
	return typeof value === "bigint" ? Number(value) : undefined;
};
const text = (struct: ThriftStruct, id: number) => {
	const value = struct.get(id);
	return Buffer.isBuffer(value) ? value.toString("utf8") : undefined;
};
const structs = (struct: ThriftStruct, id: number) =>
	(struct.get(id) as ThriftStruct[] | undefined) ?? [];

export type SchemaNode = {
	name: string;
	/** Physical type, absent on a group. */
	type?: number;
	repetition?: number;
	convertedType?: number;
	logicalType?: ThriftStruct;
	children: SchemaNode[];
};

export type ParquetFile = {
	footer: ThriftStruct;
	version: number;
	rowCount: number;
	createdBy?: string;
	schema: SchemaNode;
	metadata: Record<string, string>;
	/** Each row with groups as nested objects, as a reader presents it. */
	rows: Array<Record<string, unknown>>;
	/** Each leaf column's chunk metadata, keyed by dotted path. */
	chunks: Map<string, ThriftStruct>;
};

const readSchema = (elements: ThriftStruct[]): SchemaNode => {
	let index = 0;
	const node = (): SchemaNode => {
		const element = elements[index++]!;
		const children = Array.from(
			{ length: int(element, 5) ?? 0 },
			node,
		);
		return {
			name: text(element, 4)!,
			type: int(element, 1),
			repetition: int(element, 3),
			convertedType: int(element, 6),
			logicalType: element.get(10) as ThriftStruct | undefined,
			children,
		};
	};
	return node();
};

/** The RLE/bit-packing hybrid, both run kinds, `count` values wide. */
const hybrid = (bytes: Buffer, bitWidth: number, count: number) => {
	const reader = new CompactReader(bytes);
	const byteWidth = Math.ceil(bitWidth / 8);
	const out: number[] = [];
	while (out.length < count) {
		const header = Number(reader.varint());
		if ((header & 1) === 0) {
			let value = 0;
			for (let i = 0; i < byteWidth; i += 1)
				value |= reader.byte() << (8 * i);
			for (let i = 0; i < header >> 1; i += 1) out.push(value);
		} else {
			const values = (header >> 1) * 8;
			let buffer = 0;
			let bits = 0;
			for (let i = 0; i < values; i += 1) {
				while (bits < bitWidth) {
					buffer |= reader.byte() << bits;
					bits += 8;
				}
				out.push(buffer & ((1 << bitWidth) - 1));
				buffer >>= bitWidth;
				bits -= bitWidth;
			}
		}
	}
	return out.slice(0, count);
};

const plain = (type: number, bytes: Buffer, count: number, utf8: boolean) => {
	const out: unknown[] = [];
	let at = 0;
	for (let i = 0; i < count; i += 1) {
		switch (type) {
			case 1:
				out.push(bytes.readInt32LE(at));
				at += 4;
				break;
			case 2:
				out.push(bytes.readBigInt64LE(at));
				at += 8;
				break;
			case 5:
				out.push(bytes.readDoubleLE(at));
				at += 8;
				break;
			case 6: {
				const length = bytes.readUInt32LE(at);
				const value = bytes.subarray(at + 4, at + 4 + length);
				out.push(utf8 ? value.toString("utf8") : Buffer.from(value));
				at += 4 + length;
				break;
			}
			default:
				throw new Error(`Unsupported physical type ${type}.`);
		}
	}
	if (at !== bytes.length)
		throw new Error(
			`A page held ${bytes.length - at} bytes past its ${count} values.`,
		);
	return out;
};

const CODEC_UNCOMPRESSED = 0;
const CODEC_GZIP = 2;

export const readParquet = (file: Buffer): ParquetFile => {
	if (
		file.subarray(0, 4).toString("ascii") !== "PAR1" ||
		file.subarray(-4).toString("ascii") !== "PAR1"
	)
		throw new Error("Not a Parquet file: the magic is missing.");
	const footerLength = file.readUInt32LE(file.length - 8);
	const footerStart = file.length - 8 - footerLength;
	const footer = new CompactReader(
		file.subarray(footerStart, file.length - 8),
	).struct();
	const schema = readSchema(structs(footer, 2));
	const rowCount = int(footer, 3)!;

	// Leaves depth-first with their paths and maximum definition levels.
	const leaves: Array<{ path: string[]; node: SchemaNode; maxDef: number }> =
		[];
	const walk = (node: SchemaNode, path: string[], maxDef: number) => {
		for (const child of node.children) {
			const def = maxDef + (child.repetition === 1 ? 1 : 0);
			if (child.repetition === 2)
				throw new Error("Repeated fields are not read by this reader.");
			if (child.children.length === 0)
				leaves.push({ path: [...path, child.name], node: child, maxDef: def });
			else walk(child, [...path, child.name], def);
		}
	};
	walk(schema, [], 0);

	const rows: Array<Record<string, unknown>> = Array.from(
		{ length: rowCount },
		() => ({}),
	);
	const chunks = new Map<string, ThriftStruct>();
	for (const [groupIndex, group] of structs(footer, 4).entries()) {
		const columns = structs(group, 1);
		if (columns.length !== leaves.length)
			throw new Error(
				`Row group ${groupIndex} has ${columns.length} chunks for ${leaves.length} leaves.`,
			);
		const groupRows = int(group, 3)!;
		columns.forEach((chunk, index) => {
			const leaf = leaves[index]!;
			const meta = chunk.get(3) as ThriftStruct;
			const path = (meta.get(3) as Buffer[]).map((part) =>
				part.toString("utf8"),
			);
			if (path.join(".") !== leaf.path.join("."))
				throw new Error(
					`Chunk ${index} is ${path.join(".")}, but the schema's leaf ${index} is ${leaf.path.join(".")}.`,
				);
			chunks.set(path.join("."), meta);
			const codec = int(meta, 4);
			const values: unknown[] = [];
			let at = int(meta, 9)!;
			const end = at + int(meta, 7)!;
			while (at < end) {
				const reader = new CompactReader(file.subarray(at));
				const header = reader.struct();
				at += reader.at;
				const compressedSize = int(header, 3)!;
				const raw = file.subarray(at, at + compressedSize);
				at += compressedSize;
				if (int(header, 1) !== 0)
					throw new Error("Only data page v1 is read by this reader.");
				const body =
					codec === CODEC_GZIP
						? gunzipSync(raw)
						: codec === CODEC_UNCOMPRESSED
							? raw
							: undefined;
				if (!body) throw new Error(`Unsupported codec ${codec}.`);
				if (body.length !== int(header, 2))
					throw new Error("A page is not its declared uncompressed size.");
				const pageHeader = header.get(5) as ThriftStruct;
				const count = int(pageHeader, 1)!;
				let offset = 0;
				let levels = Array<number>(count).fill(leaf.maxDef);
				if (leaf.maxDef > 0) {
					const length = body.readUInt32LE(0);
					levels = hybrid(
						body.subarray(4, 4 + length),
						Math.ceil(Math.log2(leaf.maxDef + 1)),
						count,
					);
					offset = 4 + length;
				}
				const present = levels.filter((level) => level === leaf.maxDef);
				const decoded = plain(
					leaf.node.type!,
					body.subarray(offset),
					present.length,
					leaf.node.convertedType === 0,
				);
				let next = 0;
				for (const level of levels)
					values.push(level === leaf.maxDef ? decoded[next++] : null);
			}
			if (values.length !== groupRows)
				throw new Error(`${leaf.path.join(".")} has ${values.length} values.`);
			values.forEach((value, row) => {
				let target = rows[row]!;
				for (const part of leaf.path.slice(0, -1))
					target = (target[part] ??= {}) as Record<string, unknown>;
				target[leaf.path.at(-1)!] = value;
			});
		});
	}

	return {
		footer,
		version: int(footer, 1)!,
		rowCount,
		createdBy: text(footer, 6),
		schema,
		metadata: Object.fromEntries(
			structs(footer, 5).map((entry) => [text(entry, 1)!, text(entry, 2)!]),
		),
		rows,
		chunks,
	};
};

/** A chunk's min and max, decoded from their PLAIN bytes. */
export const chunkBounds = (chunk: ThriftStruct) => {
	const stats = chunk.get(12) as ThriftStruct | undefined;
	const type = int(chunk, 1)!;
	const decode = (id: number) => {
		const bytes = stats?.get(id);
		return Buffer.isBuffer(bytes) ? plain(type, bytes, 1, false)[0] : undefined;
	};
	return {
		min: decode(6),
		max: decode(5),
		nullCount: stats ? int(stats, 3) : undefined,
	};
};
