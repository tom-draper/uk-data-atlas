import type { Coordinate } from "../areaContainment";
import type { GeoJsonGeometry } from "../areaGeometry";
import { writeParquet } from "../parquet";
import type { TileBox } from "./tileGrid";
import { boundsOf } from "./tileset";

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

export type GeoParquetFeature = {
	id: number;
	code: string;
	name: string;
	geometry: GeoJsonGeometry;
};

export const buildGeoParquet = (
	features: GeoParquetFeature[],
	/** What the file is, carried inside it so a copy on its own is citable. */
	about: Record<string, unknown>,
): Buffer => {
	const sorted = [...features].sort((left, right) => left.id - right.id);
	const boxes = sorted.map((feature) => boundsOf(feature.geometry));
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
					...new Set(sorted.map((feature) => feature.geometry.type)),
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
	return writeParquet({
		columns: [
			{ name: "id", type: "int32", values: sorted.map((feature) => feature.id) },
			{ name: "code", type: "string", values: sorted.map((feature) => feature.code) },
			{ name: "name", type: "string", values: sorted.map((feature) => feature.name) },
			{
				name: "geometry",
				type: "binary",
				values: sorted.map((feature) => toWkb(feature.geometry)),
			},
			{ name: "bbox.xmin", type: "double", values: boxes.map((box) => box[0]) },
			{ name: "bbox.ymin", type: "double", values: boxes.map((box) => box[1]) },
			{ name: "bbox.xmax", type: "double", values: boxes.map((box) => box[2]) },
			{ name: "bbox.ymax", type: "double", values: boxes.map((box) => box[3]) },
		],
		metadata: { geo: JSON.stringify(geo), "uk-data-atlas": JSON.stringify(about) },
	});
};
