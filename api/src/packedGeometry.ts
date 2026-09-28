import type { GeoJsonGeometry } from "./areaGeometry";
import { geometryBounds, type GeometryBounds } from "./areaContainment";

/**
 * A GeoJSON geometry held as flat typed arrays. Parsed GeoJSON stores every
 * position as its own array inside arrays of rings and parts, which costs
 * about ten times the coordinates themselves: an LSOA release is some 430 MB
 * of heap as objects and 33 MB as Float64 numbers. The geometry cache keeps
 * areas packed and builds the GeoJSON form only for the areas a request
 * reads.
 *
 * Packing is exact. Every number is kept as the same double, and unpacking
 * rebuilds the same nesting, so a caller cannot tell a round trip from the
 * original.
 */
export type PackedGeometry =
	| {
			kind: "packed";
			type: string;
			/** Numbers per position, taken from the first position. */
			stride: number;
			positions: Float64Array;
			/**
			 * Child counts for each nesting level above the positions, outermost
			 * first: for a MultiPolygon, polygons per geometry is implicit, then
			 * rings per polygon, then positions per ring.
			 */
			counts: Uint32Array[];
	  }
	| { kind: "collection"; geometries: PackedGeometry[] }
	/** Anything not a standard, uniform geometry is held as it came. */
	| { kind: "raw"; geometry: GeoJsonGeometry };

/** How many array levels sit above a position, by geometry type. */
const DEPTH: Record<string, number> = {
	Point: 0,
	MultiPoint: 1,
	LineString: 1,
	MultiLineString: 2,
	Polygon: 2,
	MultiPolygon: 3,
};

const isPosition = (value: unknown): value is number[] =>
	Array.isArray(value) &&
	value.length > 0 &&
	value.every((item) => typeof item === "number");

export const packGeometry = (geometry: GeoJsonGeometry): PackedGeometry => {
	if (geometry.type === "GeometryCollection")
		return {
			kind: "collection",
			geometries: (geometry.geometries ?? []).map(packGeometry),
		};
	const depth = DEPTH[geometry.type];
	if (depth === undefined) return { kind: "raw", geometry };
	const numbers: number[] = [];
	const counts: number[][] = Array.from({ length: depth }, () => []);
	let stride = -1;
	const walk = (value: unknown, level: number): boolean => {
		if (level === depth) {
			if (!isPosition(value)) return false;
			if (stride === -1) stride = value.length;
			if (value.length !== stride) return false;
			for (const number of value) numbers.push(number);
			return true;
		}
		if (!Array.isArray(value)) return false;
		counts[level]!.push(value.length);
		return value.every((child) => walk(child, level + 1));
	};
	if (!walk(geometry.coordinates, 0) || stride === -1)
		return { kind: "raw", geometry };
	return {
		kind: "packed",
		type: geometry.type,
		stride,
		positions: Float64Array.from(numbers),
		counts: counts.map((level) => Uint32Array.from(level)),
	};
};

export const unpackGeometry = (packed: PackedGeometry): GeoJsonGeometry => {
	if (packed.kind === "raw") return packed.geometry;
	if (packed.kind === "collection")
		return {
			type: "GeometryCollection",
			geometries: packed.geometries.map(unpackGeometry),
		};
	const { positions, stride, counts } = packed;
	const cursors = counts.map(() => 0);
	let at = 0;
	const build = (level: number): unknown => {
		if (level === counts.length) {
			const position = Array.from(positions.subarray(at, at + stride));
			at += stride;
			return position;
		}
		const length = counts[level]![cursors[level]!]!;
		cursors[level]! += 1;
		const children = new Array(length);
		for (let index = 0; index < length; index += 1)
			children[index] = build(level + 1);
		return children;
	};
	return { type: packed.type, coordinates: build(0) };
};

/** The geometry's WGS84 envelope, read straight from the packed numbers. */
export const packedBounds = (
	packed: PackedGeometry,
): GeometryBounds | undefined => {
	if (packed.kind === "raw") return geometryBounds(packed.geometry);
	if (packed.kind === "collection") {
		let merged: GeometryBounds | undefined;
		for (const part of packed.geometries) {
			const bounds = packedBounds(part);
			if (!bounds) continue;
			merged = merged
				? [
						Math.min(merged[0], bounds[0]),
						Math.min(merged[1], bounds[1]),
						Math.max(merged[2], bounds[2]),
						Math.max(merged[3], bounds[3]),
					]
				: bounds;
		}
		return merged;
	}
	const { positions, stride } = packed;
	if (positions.length === 0 || stride < 2) return undefined;
	let west = Infinity;
	let south = Infinity;
	let east = -Infinity;
	let north = -Infinity;
	for (let at = 0; at < positions.length; at += stride) {
		const longitude = positions[at]!;
		const latitude = positions[at + 1]!;
		if (longitude < west) west = longitude;
		if (longitude > east) east = longitude;
		if (latitude < south) south = latitude;
		if (latitude > north) north = latitude;
	}
	return [west, south, east, north];
};

/** Bytes held by the packed numbers, for the cache's own accounting. */
export const packedBytes = (packed: PackedGeometry): number =>
	packed.kind === "packed"
		? packed.positions.byteLength +
			packed.counts.reduce((sum, level) => sum + level.byteLength, 0)
		: packed.kind === "collection"
			? packed.geometries.reduce(
					(sum, part) => sum + packedBytes(part),
					0,
				)
			: 0;
