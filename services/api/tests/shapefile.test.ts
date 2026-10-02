import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readShapefileFeatures } from "../src/shapefile";

type Ring = Array<[number, number]>;

// A shape is a list of rings, or null for a null shape. Rings are written as a
// Shapefile draws them: outer rings clockwise, holes counter-clockwise.
const shp = (shapes: Array<Ring[] | null>, shapeType = 5) => {
	const records = shapes.map((rings, index) => {
		const points = rings?.flat() ?? [];
		const content = Buffer.alloc(
			rings ? 44 + rings.length * 4 + points.length * 16 : 4,
		);
		content.writeInt32LE(rings ? shapeType : 0, 0);
		if (rings) {
			content.writeInt32LE(rings.length, 36);
			content.writeInt32LE(points.length, 40);
			let start = 0;
			rings.forEach((ring, part) => {
				content.writeInt32LE(start, 44 + part * 4);
				start += ring.length;
			});
			const offset = 44 + rings.length * 4;
			points.forEach(([x, y], point) => {
				content.writeDoubleLE(x, offset + point * 16);
				content.writeDoubleLE(y, offset + point * 16 + 8);
			});
		}
		const header = Buffer.alloc(8);
		header.writeInt32BE(index + 1, 0);
		header.writeInt32BE(content.length / 2, 4);
		return Buffer.concat([header, content]);
	});
	const header = Buffer.alloc(100);
	const length = 100 + records.reduce((total, r) => total + r.length, 0);
	header.writeInt32BE(9994, 0);
	header.writeInt32BE(length / 2, 24);
	header.writeInt32LE(1000, 28);
	header.writeInt32LE(shapeType, 32);
	return Buffer.concat([header, ...records]);
};

// A dBase table with one ten-character CODE field; a null code marks the
// record deleted.
const dbf = (codes: Array<string | null>) => {
	const header = Buffer.alloc(32 + 32 + 1);
	header[0] = 3;
	header.writeUInt32LE(codes.length, 4);
	header.writeUInt16LE(header.length, 8);
	header.writeUInt16LE(11, 10);
	header.write("CODE", 32, "latin1");
	header[32 + 11] = "C".charCodeAt(0);
	header[32 + 16] = 10;
	header[header.length - 1] = 0x0d;
	const rows = codes.map((code) =>
		Buffer.from(
			`${code === null ? "*" : " "}${(code ?? "").padEnd(10)}`,
			"latin1",
		),
	);
	return Buffer.concat([header, ...rows]);
};

const withShapefile = (
	shapes: Array<Ring[] | null>,
	codes: Array<string | null>,
	shapeType?: number,
	run?: (path: string) => void,
) => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-shp-"));
	try {
		const path = join(directory, "areas.shp");
		writeFileSync(path, shp(shapes, shapeType));
		writeFileSync(join(directory, "areas.dbf"), dbf(codes));
		run?.(path);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
};

const square = (x: number, y: number, size: number): Ring => [
	[x, y],
	[x, y + size],
	[x + size, y + size],
	[x + size, y],
	[x, y],
];
const reversed = (ring: Ring): Ring => [...ring].reverse();

test("reads polygons with holes and several parts, in GeoJSON winding order", () => {
	withShapefile(
		[
			[square(0, 0, 10), reversed(square(2, 2, 2))],
			null,
			[square(0, 0, 1), square(20, 20, 5), reversed(square(21, 21, 1))],
			[square(50, 50, 1)],
		],
		["A1", "NULL", "B2", null],
		5,
		(path) => {
			const features = readShapefileFeatures(path);
			assert.deepEqual(
				features.map((feature) => [
					feature.properties.CODE,
					feature.geometry.type,
				]),
				[
					["A1", "Polygon"],
					["B2", "MultiPolygon"],
				],
			);
			const polygon = features[0].geometry;
			assert.equal(polygon.type, "Polygon");
			if (polygon.type !== "Polygon") return;
			assert.deepEqual(
				polygon.coordinates[0],
				reversed(square(0, 0, 10)),
			);
			assert.deepEqual(polygon.coordinates[1], square(2, 2, 2));
			const multi = features[1].geometry;
			if (multi.type !== "MultiPolygon") return;
			// The hole belongs to the ring that contains it, not the first ring.
			assert.deepEqual(
				multi.coordinates.map((part) => part.length),
				[1, 2],
			);
		},
	);
});

test("refuses shapes that are not polygons and a table that does not match", () => {
	withShapefile([[square(0, 0, 1)]], ["A1"], 3, (path) =>
		assert.throws(
			() => readShapefileFeatures(path),
			/shape type 3 is not a polygon/,
		),
	);
	withShapefile([[square(0, 0, 1)]], ["A1", "A2"], 5, (path) =>
		assert.throws(
			() => readShapefileFeatures(path),
			/1 shapes but 2 attribute records/,
		),
	);
});
