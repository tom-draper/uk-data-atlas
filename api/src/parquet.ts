import { gzipSync } from "node:zlib";

/**
 * A Parquet file writer, written from the Apache Parquet format specification
 * rather than taken from a library, for the same reason the tile encoder is:
 * what a published file contains should be decided here, byte for byte, and a
 * rebuild should give the same bytes.
 *
 * It writes the small subset a whole-table download needs. One row group, one
 * data page per column, PLAIN values, GZIP pages. Columns are flat or sit in
 * one level of required groups, which is how GeoParquet's `bbox` covering is
 * shaped, and a column may be optional. There is no dictionary encoding and no
 * repetition: nothing published is a list.
 *
 * The file metadata is Thrift's compact protocol. Numeric columns carry
 * min/max statistics with the type-defined order declared, so a reader such
 * as DuckDB can skip a file whose bounds miss its filter.
 */

export type ParquetType = "int32" | "int64" | "double" | "string" | "binary";

export type ParquetColumn = {
	/** A top-level name, or `group.field` for a field of a required group. */
	name: string;
	type: ParquetType;
	optional?: boolean;
	/** One value per row; `null` only in an optional column. */
	values: ReadonlyArray<number | bigint | string | Uint8Array | null>;
};

export type ParquetTable = {
	columns: ParquetColumn[];
	/** File-level key/value metadata, such as GeoParquet's `geo`. */
	metadata?: Record<string, string>;
};

// Enumerations from parquet.thrift.
const TYPE = { int32: 1, int64: 2, double: 5, string: 6, binary: 6 } as const;
const REPETITION = { required: 0, optional: 1 } as const;
const CONVERTED_UTF8 = 0;
const ENCODING_PLAIN = 0;
const ENCODING_RLE = 3;
const CODEC_GZIP = 2;
const PAGE_DATA = 0;

export const CREATED_BY = "uk-data-atlas parquet writer";

/**
 * Thrift compact protocol, the parts file metadata uses. A struct is a list
 * of fields, each written with its id as a delta from the previous one.
 */
type Field =
	| { id: number; kind: "i32"; value: number }
	| { id: number; kind: "i64"; value: number | bigint }
	| { id: number; kind: "binary"; value: Uint8Array | string }
	| { id: number; kind: "struct"; value: Field[] }
	| { id: number; kind: "list-i32"; value: number[] }
	| { id: number; kind: "list-binary"; value: string[] }
	| { id: number; kind: "list-struct"; value: Field[][] };

const COMPACT = {
	i32: 5,
	i64: 6,
	binary: 8,
	list: 9,
	struct: 12,
} as const;

class CompactWriter {
	private bytes: number[] = [];

	varint(value: bigint) {
		let rest = value;
		while (rest >= 0x80n) {
			this.bytes.push(Number((rest & 0x7fn) | 0x80n));
			rest >>= 7n;
		}
		this.bytes.push(Number(rest));
	}

	zigzag(value: number | bigint) {
		const big = BigInt(value);
		this.varint(big >= 0n ? big << 1n : (-big << 1n) - 1n);
	}

	binary(value: Uint8Array | string) {
		const bytes =
			typeof value === "string" ? Buffer.from(value, "utf8") : value;
		this.varint(BigInt(bytes.length));
		for (const byte of bytes) this.bytes.push(byte);
	}

	listHeader(size: number, elementType: number) {
		if (size < 15) this.bytes.push((size << 4) | elementType);
		else {
			this.bytes.push(0xf0 | elementType);
			this.varint(BigInt(size));
		}
	}

	struct(fields: Field[]) {
		let last = 0;
		for (const field of fields) {
			const type =
				field.kind === "i32"
					? COMPACT.i32
					: field.kind === "i64"
						? COMPACT.i64
						: field.kind === "binary"
							? COMPACT.binary
							: field.kind === "struct"
								? COMPACT.struct
								: COMPACT.list;
			const delta = field.id - last;
			if (delta > 0 && delta <= 15) this.bytes.push((delta << 4) | type);
			else {
				this.bytes.push(type);
				this.zigzag(field.id);
			}
			last = field.id;
			switch (field.kind) {
				case "i32":
				case "i64":
					this.zigzag(field.value);
					break;
				case "binary":
					this.binary(field.value);
					break;
				case "struct":
					this.struct(field.value);
					break;
				case "list-i32":
					this.listHeader(field.value.length, COMPACT.i32);
					for (const item of field.value) this.zigzag(item);
					break;
				case "list-binary":
					this.listHeader(field.value.length, COMPACT.binary);
					for (const item of field.value) this.binary(item);
					break;
				case "list-struct":
					this.listHeader(field.value.length, COMPACT.struct);
					for (const item of field.value) this.struct(item);
					break;
			}
		}
		this.bytes.push(0);
	}

	toBuffer() {
		return Buffer.from(this.bytes);
	}
}

const thrift = (fields: Field[]) => {
	const writer = new CompactWriter();
	writer.struct(fields);
	return writer.toBuffer();
};

/** PLAIN encoding of the values present, nulls left to the definition levels. */
const plainValues = (column: ParquetColumn): Buffer => {
	const present = column.values.filter((value) => value !== null);
	switch (column.type) {
		case "int32": {
			const out = Buffer.alloc(present.length * 4);
			present.forEach((value, index) => {
				if (typeof value !== "number" || !Number.isInteger(value))
					throw new Error(`${column.name} holds a non-integer.`);
				out.writeInt32LE(value, index * 4);
			});
			return out;
		}
		case "int64": {
			const out = Buffer.alloc(present.length * 8);
			present.forEach((value, index) => {
				if (typeof value !== "number" && typeof value !== "bigint")
					throw new Error(`${column.name} holds a non-integer.`);
				out.writeBigInt64LE(BigInt(value), index * 8);
			});
			return out;
		}
		case "double": {
			const out = Buffer.alloc(present.length * 8);
			present.forEach((value, index) => {
				if (typeof value !== "number")
					throw new Error(`${column.name} holds a non-number.`);
				out.writeDoubleLE(value, index * 8);
			});
			return out;
		}
		case "string":
		case "binary": {
			const parts = present.map((value) => {
				const bytes =
					typeof value === "string"
						? Buffer.from(value, "utf8")
						: value instanceof Uint8Array
							? Buffer.from(value)
							: undefined;
				if (!bytes)
					throw new Error(
						`${column.name} holds a non-${column.type}.`,
					);
				const length = Buffer.alloc(4);
				length.writeUInt32LE(bytes.length);
				return [length, bytes];
			});
			return Buffer.concat(parts.flat());
		}
	}
};

/**
 * Definition levels for an optional column, as the RLE/bit-packing hybrid
 * with a bit width of one. Runs of equal levels are written as RLE runs,
 * which is always valid and, for a column that is rarely null, short.
 */
const definitionLevels = (values: ParquetColumn["values"]): Buffer => {
	const bytes: Buffer[] = [];
	let index = 0;
	while (index < values.length) {
		const level = values[index] === null ? 0 : 1;
		let length = 1;
		while (
			index + length < values.length &&
			(values[index + length] === null ? 0 : 1) === level
		)
			length += 1;
		const header = new CompactWriter();
		header.varint(BigInt(length) << 1n);
		bytes.push(header.toBuffer(), Buffer.from([level]));
		index += length;
	}
	const body = Buffer.concat(bytes);
	const prefix = Buffer.alloc(4);
	prefix.writeUInt32LE(body.length);
	return Buffer.concat([prefix, body]);
};

/** Min and max in the column's own PLAIN form, for numeric columns only. */
const statistics = (column: ParquetColumn): Field[] | undefined => {
	const present = column.values.filter((value) => value !== null);
	const nulls = column.values.length - present.length;
	if (column.type === "string" || column.type === "binary")
		return [{ id: 3, kind: "i64", value: nulls }];
	if (present.length === 0) return [{ id: 3, kind: "i64", value: nulls }];
	const numbers = present as Array<number | bigint>;
	// NaN has no place in an order, so a column holding one states no bounds.
	if (numbers.some((value) => Number.isNaN(value)))
		return [{ id: 3, kind: "i64", value: nulls }];
	let min = numbers[0]!;
	let max = numbers[0]!;
	for (const value of numbers) {
		if (value < min) min = value;
		if (value > max) max = value;
	}
	// The specification's rule for floating-point bounds: a zero minimum is
	// written as -0 and a zero maximum as +0, so either zero is inside them.
	if (column.type === "double") {
		if (min === 0) min = -0;
		if (max === 0) max = 0;
	}
	const encode = (value: number | bigint) =>
		plainValues({ ...column, optional: false, values: [value] });
	return [
		{ id: 3, kind: "i64", value: nulls },
		{ id: 5, kind: "binary", value: encode(max) },
		{ id: 6, kind: "binary", value: encode(min) },
	];
};

const leafElement = (name: string, column: ParquetColumn): Field[] => [
	{ id: 1, kind: "i32", value: TYPE[column.type] },
	{
		id: 3,
		kind: "i32",
		value: column.optional ? REPETITION.optional : REPETITION.required,
	},
	{ id: 4, kind: "binary", value: name },
	...(column.type === "string"
		? ([
				{ id: 6, kind: "i32", value: CONVERTED_UTF8 },
				// LogicalType is a union; field 1 is STRING, an empty struct.
				{
					id: 10,
					kind: "struct",
					value: [{ id: 1, kind: "struct", value: [] }],
				},
			] satisfies Field[])
		: []),
];

/** The schema tree, flattened depth-first as the footer lists it. */
const schemaElements = (columns: ParquetColumn[]): Field[][] => {
	const top: Array<
		| { kind: "leaf"; column: ParquetColumn }
		| { kind: "group"; name: string; children: ParquetColumn[] }
	> = [];
	for (const column of columns) {
		const [group, field, ...rest] = column.name.split(".");
		if (rest.length > 0 || field === "")
			throw new Error(`${column.name} is nested more than one level.`);
		if (field === undefined) {
			top.push({ kind: "leaf", column });
			continue;
		}
		if (column.optional)
			throw new Error(`${column.name}: a group's fields are required.`);
		const existing = top.find((entry) =>
			entry.kind === "group"
				? entry.name === group
				: entry.column.name === group,
		);
		if (existing && existing.kind === "group")
			existing.children.push(column);
		else if (existing)
			throw new Error(`${group} is both a column and a group.`);
		else top.push({ kind: "group", name: group!, children: [column] });
	}
	const names = top.map((entry) =>
		entry.kind === "leaf" ? entry.column.name : entry.name,
	);
	if (new Set(names).size !== names.length)
		throw new Error("A Parquet table's column names must be unique.");
	return [
		[
			{ id: 4, kind: "binary", value: "schema" },
			{ id: 5, kind: "i32", value: top.length },
		],
		...top.flatMap((entry) =>
			entry.kind === "leaf"
				? [leafElement(entry.column.name, entry.column)]
				: [
						[
							{ id: 3, kind: "i32", value: REPETITION.required },
							{ id: 4, kind: "binary", value: entry.name },
							{
								id: 5,
								kind: "i32",
								value: entry.children.length,
							},
						] satisfies Field[],
						...entry.children.map((child) =>
							leafElement(child.name.split(".")[1]!, child),
						),
					],
		),
	];
};

const MAGIC = Buffer.from("PAR1", "ascii");

/**
 * Leaf columns in schema order: a group's fields sit together at the place
 * the group first appears, which is the order column chunks must follow.
 */
const leafOrder = (columns: ParquetColumn[]) => {
	const groups = new Map<string, ParquetColumn[]>();
	const order: ParquetColumn[][] = [];
	for (const column of columns) {
		const group = column.name.includes(".")
			? column.name.split(".")[0]!
			: undefined;
		if (group === undefined) {
			order.push([column]);
			continue;
		}
		const members = groups.get(group);
		if (members) members.push(column);
		else {
			const created = [column];
			groups.set(group, created);
			order.push(created);
		}
	}
	return order.flat();
};

export const writeParquet = (table: ParquetTable): Buffer => {
	const rowCount = table.columns[0]?.values.length ?? 0;
	if (table.columns.length === 0)
		throw new Error("A Parquet table needs at least one column.");
	for (const column of table.columns) {
		if (column.values.length !== rowCount)
			throw new Error(
				`${column.name} has ${column.values.length} values for ${rowCount} rows.`,
			);
		if (!column.optional && column.values.includes(null))
			throw new Error(`${column.name} is required but holds a null.`);
	}
	const schema = schemaElements(table.columns);
	const columns = leafOrder(table.columns);

	const chunks: Buffer[] = [MAGIC];
	let offset = MAGIC.length;
	let totalUncompressed = 0;
	let totalCompressed = 0;
	const columnChunks: Field[][] = [];
	for (const column of columns) {
		const values = plainValues(column);
		const body = column.optional
			? Buffer.concat([definitionLevels(column.values), values])
			: values;
		// mtime 0 and a fixed level keep the page bytes a function of the
		// values alone.
		const compressed = gzipSync(body, { level: 9 });
		const header = thrift([
			{ id: 1, kind: "i32", value: PAGE_DATA },
			{ id: 2, kind: "i32", value: body.length },
			{ id: 3, kind: "i32", value: compressed.length },
			{
				id: 5,
				kind: "struct",
				value: [
					{ id: 1, kind: "i32", value: column.values.length },
					{ id: 2, kind: "i32", value: ENCODING_PLAIN },
					{ id: 3, kind: "i32", value: ENCODING_RLE },
					{ id: 4, kind: "i32", value: ENCODING_RLE },
				],
			},
		]);
		const uncompressedSize = header.length + body.length;
		const compressedSize = header.length + compressed.length;
		const stats = statistics(column);
		columnChunks.push([
			{ id: 2, kind: "i64", value: offset },
			{
				id: 3,
				kind: "struct",
				value: [
					{ id: 1, kind: "i32", value: TYPE[column.type] },
					{
						id: 2,
						kind: "list-i32",
						value: [ENCODING_PLAIN, ENCODING_RLE],
					},
					{
						id: 3,
						kind: "list-binary",
						value: column.name.split("."),
					},
					{ id: 4, kind: "i32", value: CODEC_GZIP },
					{ id: 5, kind: "i64", value: column.values.length },
					{ id: 6, kind: "i64", value: uncompressedSize },
					{ id: 7, kind: "i64", value: compressedSize },
					{ id: 9, kind: "i64", value: offset },
					...(stats
						? [{ id: 12, kind: "struct", value: stats } as Field]
						: []),
				],
			},
		]);
		chunks.push(header, compressed);
		offset += compressedSize;
		totalUncompressed += uncompressedSize;
		totalCompressed += compressedSize;
	}

	const footer = thrift([
		{ id: 1, kind: "i32", value: 1 },
		{ id: 2, kind: "list-struct", value: schema },
		{ id: 3, kind: "i64", value: rowCount },
		{
			id: 4,
			kind: "list-struct",
			value: [
				[
					{ id: 1, kind: "list-struct", value: columnChunks },
					{ id: 2, kind: "i64", value: totalUncompressed },
					{ id: 3, kind: "i64", value: rowCount },
					{ id: 5, kind: "i64", value: MAGIC.length },
					{ id: 6, kind: "i64", value: totalCompressed },
				],
			],
		},
		...(table.metadata && Object.keys(table.metadata).length > 0
			? [
					{
						id: 5,
						kind: "list-struct",
						value: Object.entries(table.metadata).map(
							([key, value]): Field[] => [
								{ id: 1, kind: "binary", value: key },
								{ id: 2, kind: "binary", value: value },
							],
						),
					} as Field,
				]
			: []),
		{ id: 6, kind: "binary", value: CREATED_BY },
		// ColumnOrder is a union whose field 1 is TypeDefinedOrder, one per
		// leaf column: it is what lets a reader trust min and max.
		{
			id: 7,
			kind: "list-struct",
			value: columns.map((): Field[] => [
				{ id: 1, kind: "struct", value: [] },
			]),
		},
	]);
	const length = Buffer.alloc(4);
	length.writeUInt32LE(footer.length);
	chunks.push(footer, length, MAGIC);
	return Buffer.concat(chunks);
};
