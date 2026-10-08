import type { MultiPolygon, Pair, Polygon } from "polygon-clipping";

export type Bounds = [number, number, number, number];

export type GeometryPiece = { geometry: Polygon; bounds: Bounds };
export type AreaGeometry = {
	pieces: GeometryPiece[];
	bounds: Bounds;
	areaM2: number;
	/** Spatial buckets avoid comparing every offshore island to every source. */
	pieceBuckets: Map<string, number[]>;
};

/** A multipolygon with each coordinate rounded to 1 / precision. */
export const roundedMultiPolygon = (
	geometry: MultiPolygon,
	precision: number,
): MultiPolygon =>
	geometry.map((polygon) =>
		polygon.map((ring) =>
			ring.map(
				([x, y]) =>
					[
						Math.round(x * precision) / precision,
						Math.round(y * precision) / precision,
					] as [number, number],
			),
		),
	);

/** An area's pieces as one multipolygon, optionally rounded to 1 / precision. */
export const areaMultiPolygon = (
	geometry: AreaGeometry,
	precision?: number,
): MultiPolygon => {
	const polygons = geometry.pieces.map((piece) => piece.geometry);
	return precision === undefined
		? polygons
		: roundedMultiPolygon(polygons, precision);
};

const PIECE_BUCKET_SIZE_DEGREES = 0.25;

const bucketRange = ([west, south, east, north]: Bounds) => ({
	west: Math.floor(west / PIECE_BUCKET_SIZE_DEGREES),
	south: Math.floor(south / PIECE_BUCKET_SIZE_DEGREES),
	east: Math.floor(east / PIECE_BUCKET_SIZE_DEGREES),
	north: Math.floor(north / PIECE_BUCKET_SIZE_DEGREES),
});

const bucketKey = (x: number, y: number) => `${x}/${y}`;

export const indexPieces = (pieces: GeometryPiece[]) => {
	const buckets = new Map<string, number[]>();
	for (const [index, piece] of pieces.entries()) {
		const range = bucketRange(piece.bounds);
		for (let x = range.west; x <= range.east; x += 1)
			for (let y = range.south; y <= range.north; y += 1) {
				const key = bucketKey(x, y);
				const entries = buckets.get(key) ?? [];
				entries.push(index);
				buckets.set(key, entries);
			}
	}
	return buckets;
};

export const candidatePieces = (
	target: AreaGeometry,
	source: GeometryPiece,
) => {
	const candidates = new Set<number>();
	const range = bucketRange(source.bounds);
	for (let x = range.west; x <= range.east; x += 1)
		for (let y = range.south; y <= range.north; y += 1)
			for (const index of target.pieceBuckets.get(bucketKey(x, y)) ?? [])
				candidates.add(index);
	return [...candidates].map((index) => target.pieces[index]!);
};

export const boundsOf = (multiPolygon: MultiPolygon): Bounds => {
	const bounds: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
	for (const [outer] of multiPolygon) {
		for (const [x, y] of outer) {
			bounds[0] = Math.min(bounds[0], x);
			bounds[1] = Math.min(bounds[1], y);
			bounds[2] = Math.max(bounds[2], x);
			bounds[3] = Math.max(bounds[3], y);
		}
	}
	return bounds;
};

export const boundsIntersect = (left: Bounds, right: Bounds) =>
	left[0] <= right[2] &&
	right[0] <= left[2] &&
	left[1] <= right[3] &&
	right[1] <= left[3];

export const toPolygons = (
	geometry: unknown,
	description: string,
): Polygon[] => {
	const { type, coordinates } = geometry as {
		type?: unknown;
		coordinates?: unknown;
	};
	const polygons =
		type === "Polygon"
			? [coordinates]
			: type === "MultiPolygon"
				? coordinates
				: undefined;
	if (!Array.isArray(polygons)) {
		throw new Error(`${description} is not a Polygon or MultiPolygon.`);
	}
	return (polygons as number[][][][]).map((polygon) =>
		polygon.map((ring) => ring.map(([x, y]) => [x, y] as Pair)),
	);
};
