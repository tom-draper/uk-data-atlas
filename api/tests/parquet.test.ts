import assert from "node:assert/strict";
import test from "node:test";
import { CREATED_BY, writeParquet, type ParquetTable } from "../src/parquet";
import { chunkBounds, readParquet } from "./parquetFixtures";

/**
 * The Parquet writer, read back with a reader written from the specification
 * rather than from the writer. The reader decodes the footer with a general
 * Thrift compact decoder, so a field written under the wrong id or type is
 * read as something else rather than agreed with.
 */

const table: ParquetTable = {
	columns: [
		{ name: "id", type: "int32", values: [3, 1, 2] },
		{
			name: "code",
			type: "string",
			values: ["E06000001", "W06000001", "Ynys Môn"],
		},
		{
			name: "value",
			type: "double",
			optional: true,
			values: [1.5, null, -2.25],
		},
		{ name: "count", type: "int64", values: [0n, 9007199254740993n, -1] },
		{ name: "bbox.xmin", type: "double", values: [-1, -2, -3] },
		{
			name: "geometry",
			type: "binary",
			values: [
				new Uint8Array([1]),
				new Uint8Array([]),
				new Uint8Array([2, 3]),
			],
		},
		{ name: "bbox.xmax", type: "double", values: [1, 2, 3] },
	],
	metadata: { geo: '{"version":"1.1.0"}', atlas: "yes" },
};

test("reads back every value, null and group it was given", () => {
	const file = readParquet(writeParquet(table));
	assert.equal(file.rowCount, 3);
	assert.deepEqual(file.rows, [
		{
			id: 3,
			code: "E06000001",
			value: 1.5,
			count: 0n,
			bbox: { xmin: -1, xmax: 1 },
			geometry: Buffer.from([1]),
		},
		{
			id: 1,
			code: "W06000001",
			value: null,
			count: 9007199254740993n,
			bbox: { xmin: -2, xmax: 2 },
			geometry: Buffer.from([]),
		},
		{
			id: 2,
			code: "Ynys Môn",
			value: -2.25,
			count: -1n,
			bbox: { xmin: -3, xmax: 3 },
			geometry: Buffer.from([2, 3]),
		},
	]);
});

test("declares the schema a reader needs to interpret the bytes", () => {
	const { schema } = readParquet(writeParquet(table));
	assert.equal(schema.name, "schema");
	// A group gathers its fields where it first appears, in the order given.
	assert.deepEqual(
		schema.children.map((child) => child.name),
		["id", "code", "value", "count", "bbox", "geometry"],
	);
	const [id, code, value, count, bbox, geometry] = schema.children;
	assert.deepEqual([id!.type, id!.repetition], [1, 0]);
	// A string is BYTE_ARRAY marked UTF8 both ways, for old and new readers.
	assert.deepEqual([code!.type, code!.convertedType], [6, 0]);
	assert.ok(code!.logicalType?.has(1), "string has no STRING logical type");
	assert.deepEqual([value!.type, value!.repetition], [5, 1]);
	assert.equal(count!.type, 2);
	assert.equal(bbox!.type, undefined);
	assert.equal(bbox!.repetition, 0);
	assert.deepEqual(
		bbox!.children.map((child) => [child.name, child.type]),
		[
			["xmin", 5],
			["xmax", 5],
		],
	);
	// Plain bytes are not text, so nothing tells a reader to decode them.
	assert.deepEqual([geometry!.type, geometry!.convertedType], [6, undefined]);
});

test("carries file metadata and names its writer", () => {
	const file = readParquet(writeParquet(table));
	assert.deepEqual(file.metadata, table.metadata);
	assert.equal(file.createdBy, CREATED_BY);
	// One TypeDefinedOrder per leaf, or a reader may not trust min and max.
	assert.equal((file.footer.get(7) as unknown[]).length, 7);
});

test("writes the same bytes for the same table", () => {
	assert.deepEqual(writeParquet(table), writeParquet(table));
});

test("bounds numeric columns so a reader can skip a file", () => {
	const { chunks } = readParquet(writeParquet(table));
	assert.deepEqual(chunkBounds(chunks.get("id")!), {
		min: 1,
		max: 3,
		nullCount: 0,
	});
	assert.deepEqual(chunkBounds(chunks.get("value")!), {
		min: -2.25,
		max: 1.5,
		nullCount: 1,
	});
	assert.deepEqual(chunkBounds(chunks.get("count")!), {
		min: -1n,
		max: 9007199254740993n,
		nullCount: 0,
	});
	assert.deepEqual(chunkBounds(chunks.get("bbox.xmin")!), {
		min: -3,
		max: -1,
		nullCount: 0,
	});
	// Byte strings have no bounds under the order declared for them here.
	assert.deepEqual(chunkBounds(chunks.get("code")!), {
		min: undefined,
		max: undefined,
		nullCount: 0,
	});
});

test("follows the specification's rules for zero and NaN bounds", () => {
	const zeros = readParquet(
		writeParquet({
			columns: [
				{ name: "low", type: "double", values: [0, 1] },
				{ name: "high", type: "double", values: [-0, -1] },
				{ name: "nan", type: "double", values: [1, Number.NaN] },
			],
		}),
	).chunks;
	assert.ok(Object.is(chunkBounds(zeros.get("low")!).min, -0));
	assert.ok(Object.is(chunkBounds(zeros.get("high")!).max, 0));
	assert.equal(chunkBounds(zeros.get("nan")!).min, undefined);
});

test("reads long runs, many columns and an empty table", () => {
	const nulls = Array.from({ length: 1000 }, (_, index) =>
		index < 700 ? null : index,
	);
	const columns = Array.from({ length: 20 }, (_, index) => ({
		name: `c${index}`,
		type: "double" as const,
		optional: true,
		values: nulls,
	}));
	const file = readParquet(writeParquet({ columns }));
	assert.equal(file.schema.children.length, 20);
	assert.equal(file.rows[699]!.c19, null);
	assert.equal(file.rows[700]!.c19, 700);
	assert.equal(file.rows.filter((row) => row.c0 === null).length, 700);

	const empty = readParquet(
		writeParquet({ columns: [{ name: "id", type: "int32", values: [] }] }),
	);
	assert.equal(empty.rowCount, 0);
	assert.deepEqual(empty.rows, []);
});

test("refuses a table it cannot write faithfully", () => {
	const refuses = (columns: ParquetTable["columns"], message: RegExp) =>
		assert.throws(() => writeParquet({ columns }), message);
	refuses([], /at least one column/);
	refuses(
		[
			{ name: "a", type: "int32", values: [1] },
			{ name: "b", type: "int32", values: [1, 2] },
		],
		/has 2 values for 1 rows/,
	);
	refuses(
		[{ name: "a", type: "int32", values: [null] }],
		/required but holds a null/,
	);
	refuses([{ name: "a", type: "int32", values: [1.5] }], /non-integer/);
	refuses(
		[{ name: "a.b.c", type: "int32", values: [1] }],
		/more than one level/,
	);
	refuses(
		[
			{ name: "a", type: "int32", values: [1] },
			{ name: "a", type: "int32", values: [1] },
		],
		/must be unique/,
	);
	refuses(
		[
			{ name: "a", type: "int32", values: [1] },
			{ name: "a.b", type: "int32", values: [1] },
		],
		/both a column and a group/,
	);
	refuses(
		[{ name: "a.b", type: "int32", optional: true, values: [1] }],
		/fields are required/,
	);
});
