import type { Coordinate } from "@uk-data-atlas/geography/geometry-point-containment";
import type { GeoJsonGeometry } from "../areaGeometry";
import type { PackedGeometry } from "../packedGeometry";
import { writeParquet, type ParquetTable } from "../parquet";
import type { TileBox } from "@uk-data-atlas/map-tiles/tileGrid";
import { boundsOf } from "@uk-data-atlas/map-tiles/tileset";

/**
 * One tier of a map resource as GeoParquet 1.1: a row per area with the same
 * `id`, `code` and `name` the tiles carry, its shape as WKB and its bounding
 * box as a covering column.
 *
 * This is the flat form of the resource for a warehouse or a GIS that would
 * rather hold features than tiles. It is compiled from the same shared-arc
 * tier the tiles are drawn from, so a feature here and the same feature in a
 * tile agree along every border, and the ids are the ids a join table uses.
 */

export const GEOPARQUET_VERSION = "1.1.0";

// WKB geometry types, ISO 13249-3 / OGC Simple Features.
const WKB_POLYGON = 3;
const WKB_MULTIPOLYGON = 6;

const ringBytes = (ring: Coordinate[]) => {
	const out = Buffer.alloc(4 + ring.length * 16);
	out.writeUInt32LE(ring.length, 0);
	ring.forEach(([longitude, latitude], index) => {
		out.writeDoubleLE(longitude, 4 + index * 16);
		out.writeDoubleLE(latitude, 12 + index * 16);
	});
	return out;
};

const polygonBytes = (rings: Coordinate[][]) => {
	const header = Buffer.alloc(9);
	header.writeUInt8(1, 0); // little-endian
	header.writeUInt32LE(WKB_POLYGON, 1);
	header.writeUInt32LE(rings.length, 5);
	return Buffer.concat([header, ...rings.map(ringBytes)]);
};

/** A polygon or multipolygon as little-endian, two-dimensional WKB. */
export const toWkb = (geometry: GeoJsonGeometry): Buffer => {
	if (geometry.type === "Polygon")
		return polygonBytes(geometry.coordinates as Coordinate[][]);
	if (geometry.type === "MultiPolygon") {
		const polygons = geometry.coordinates as Coordinate[][][];
		const header = Buffer.alloc(9);
		header.writeUInt8(1, 0);
		header.writeUInt32LE(WKB_MULTIPOLYGON, 1);
		header.writeUInt32LE(polygons.length, 5);
		return Buffer.concat([header, ...polygons.map(polygonBytes)]);
	}
	throw new Error(
		`A map resource feature is a polygon or multipolygon, not ${geometry.type}.`,
	);
};

type Ring = { positions: Float64Array; start: number; length: number };

/**
 * A packed area's polygons, read without building GeoJSON: a release of
 * output areas is millions of positions, and as nested arrays they cost
 * several times the bytes and most of the time spent writing them.
 */
const packedPolygons = (
	packed: PackedGeometry,
	into: Array<{ stride: number; rings: Ring[] }>,
): boolean => {
	if (packed.kind === "collection")
		return packed.geometries.every((part) => packedPolygons(part, into));
	if (packed.kind !== "packed") return false;
	const { positions, stride, counts } = packed;
	const depth =
		packed.type === "Polygon" ? 2 : packed.type === "MultiPolygon" ? 3 : 0;
	if (depth === 0 || counts.length !== depth || stride < 2) return false;
	const ringLengths = counts[depth - 1]!;
	const ringsPerPolygon = depth === 2 ? counts[0]! : counts[1]!;
	let ring = 0;
	let at = 0;
	for (const ringCount of ringsPerPolygon) {
		const rings: Ring[] = [];
		for (let index = 0; index < ringCount; index += 1) {
			const length = ringLengths[ring]!;
			rings.push({ positions, start: at, length });
			at += length * stride;
			ring += 1;
		}
		into.push({ stride, rings });
	}
	return true;
};

/**
 * A packed polygon or multipolygon as the WKB `toWkb` writes for its
 * GeoJSON. A collection of polygons is written as the one multipolygon it
 * is. Undefined for anything else.
 */
export const packedWkb = (
	packed: PackedGeometry,
): { type: "Polygon" | "MultiPolygon"; wkb: Buffer } | undefined => {
	if (packed.kind === "raw") {
		const { geometry } = packed;
		return geometry.type === "Polygon" || geometry.type === "MultiPolygon"
			? { type: geometry.type, wkb: toWkb(geometry) }
			: undefined;
	}
	const polygons: Array<{ stride: number; rings: Ring[] }> = [];
	if (!packedPolygons(packed, polygons) || polygons.length === 0)
		return undefined;
	const multi =
		packed.kind === "collection" || packed.type === "MultiPolygon";
	let size = multi ? 9 : 0;
	for (const polygon of polygons) {
		size += 9;
		for (const ring of polygon.rings) size += 4 + ring.length * 16;
	}
	const out = Buffer.allocUnsafe(size);
	let offset = 0;
	const header = (type: number, count: number) => {
		out.writeUInt8(1, offset); // little-endian
		out.writeUInt32LE(type, offset + 1);
		out.writeUInt32LE(count, offset + 5);
		offset += 9;
	};
	if (multi) header(WKB_MULTIPOLYGON, polygons.length);
	for (const { stride, rings } of polygons) {
		header(WKB_POLYGON, rings.length);
		for (const { positions, start, length } of rings) {
			out.writeUInt32LE(length, offset);
			offset += 4;
			for (let index = 0; index < length; index += 1) {
				const at = start + index * stride;
				out.writeDoubleLE(positions[at]!, offset);
				out.writeDoubleLE(positions[at + 1]!, offset + 8);
				offset += 16;
			}
		}
	}
	return { type: multi ? "MultiPolygon" : "Polygon", wkb: out };
};

export type GeoParquetFeature = {
	id: number;
	code: string;
	name: string;
	geometry: GeoJsonGeometry;
};

/** A feature with its shape already written as WKB, and its envelope. */
export type GeoParquetRow = {
	id: number;
	code: string;
	name: string;
	type: string;
	wkb: Buffer;
	bbox: TileBox;
};

export const buildGeoParquet = (
	features: GeoParquetFeature[],
	/** What the file is, carried inside it so a copy on its own is citable. */
	about: Record<string, unknown>,
): Buffer =>
	writeGeoParquet(
		features.map((feature) => ({
			id: feature.id,
			code: feature.code,
			name: feature.name,
			type: feature.geometry.type,
			wkb: toWkb(feature.geometry),
			bbox: boundsOf(feature.geometry),
		})),
		about,
	);

export const writeGeoParquet = (
	rows: GeoParquetRow[],
	about: Record<string, unknown>,
): Buffer => writeParquet(geoParquetTable(rows, about));

/** The GeoParquet file of these rows, as a table for the Parquet writer. */
export const geoParquetTable = (
	rows: GeoParquetRow[],
	about: Record<string, unknown>,
): ParquetTable => {
	const sorted = [...rows].sort((left, right) => left.id - right.id);
	const boxes = sorted.map((row) => row.bbox);
	const bbox: TileBox = [Infinity, Infinity, -Infinity, -Infinity];
	for (const box of boxes) {
		bbox[0] = Math.min(bbox[0], box[0]);
		bbox[1] = Math.min(bbox[1], box[1]);
		bbox[2] = Math.max(bbox[2], box[2]);
		bbox[3] = Math.max(bbox[3], box[3]);
	}
	const geo = {
		version: GEOPARQUET_VERSION,
		primary_column: "geometry",
		columns: {
			geometry: {
				encoding: "WKB",
				geometry_types: [
					...new Set(sorted.map((row) => row.type)),
				].sort(),
				// No `crs`: GeoParquet's default is OGC:CRS84, longitude then
				// latitude on WGS 84, which is what every tier is compiled in.
				edges: "planar",
				bbox,
				covering: {
					bbox: {
						xmin: ["bbox", "xmin"],
						ymin: ["bbox", "ymin"],
						xmax: ["bbox", "xmax"],
						ymax: ["bbox", "ymax"],
					},
				},
			},
		},
	};
	return {
		columns: [
			{
				name: "id",
				type: "int32",
				values: sorted.map((row) => row.id),
			},
			{
				name: "code",
				type: "string",
				values: sorted.map((row) => row.code),
			},
			{
				name: "name",
				type: "string",
				values: sorted.map((row) => row.name),
			},
			{
				name: "geometry",
				type: "binary",
				values: sorted.map((row) => row.wkb),
			},
			{
				name: "bbox.xmin",
				type: "double",
				values: boxes.map((box) => box[0]),
			},
			{
				name: "bbox.ymin",
				type: "double",
				values: boxes.map((box) => box[1]),
			},
			{
				name: "bbox.xmax",
				type: "double",
				values: boxes.map((box) => box[2]),
			},
			{
				name: "bbox.ymax",
				type: "double",
				values: boxes.map((box) => box[3]),
			},
		],
		metadata: {
			geo: JSON.stringify(geo),
			"uk-data-atlas": JSON.stringify(about),
		},
	};
};
