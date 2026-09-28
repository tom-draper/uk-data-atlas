import type { Coordinate } from "../areaContainment";
import { TILE_EXTENT } from "./vectorTile";

/**
 * Where a boundary falls on the Web Mercator tile grid, and what is left of it
 * inside one tile.
 *
 * The order of the two steps here is what keeps borders shared. Coordinates are
 * quantised to the tile's integer grid first, so two areas along a border round
 * to the same integers, and only then clipped. Clipping works on integers that
 * both sides already agree on, so the cut lands in the same place for both.
 * Doing it the other way round would cut first from unrounded coordinates and
 * let the two sides round apart.
 */

/** Tiles are cut with a margin, so a renderer can draw a line across the join. */
export const TILE_BUFFER = 64;

export type TileAddress = { z: number; x: number; y: number };

export type TileBox = [
	west: number,
	south: number,
	east: number,
	north: number,
];

/** Where a coordinate sits on the world tile grid at this zoom, tiles as units. */
export const worldTile = ([longitude, latitude]: Coordinate, z: number) => {
	const scale = 2 ** z;
	const latitudeRadians =
		(Math.min(Math.max(latitude, -85.0511), 85.0511) * Math.PI) / 180;
	return [
		((longitude + 180) / 360) * scale,
		((1 -
			Math.log(
				Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians),
			) /
				Math.PI) /
			2) *
			scale,
	] as const;
};

/** The same coordinate as integers inside one tile, y downwards from the top. */
export const toTileGrid = (
	coordinate: Coordinate,
	{ z, x, y }: TileAddress,
): [number, number] => {
	const [worldX, worldY] = worldTile(coordinate, z);
	return [
		Math.round((worldX - x) * TILE_EXTENT),
		Math.round((worldY - y) * TILE_EXTENT),
	];
};

/**
 * The longitude/latitude box a tile covers, including its buffer, so a caller
 * can tell which areas can possibly appear in it without projecting any of
 * them.
 */
export const tileBounds = (
	{ z, x, y }: TileAddress,
	buffer = TILE_BUFFER,
): TileBox => {
	const scale = 2 ** z;
	const margin = buffer / TILE_EXTENT;
	const longitude = (tileX: number) => (tileX / scale) * 360 - 180;
	const latitude = (tileY: number) =>
		(Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / scale))) * 180) /
		Math.PI;
	return [
		longitude(x - margin),
		latitude(y + 1 + margin),
		longitude(x + 1 + margin),
		latitude(y - margin),
	];
};

/** The tiles at this zoom that a longitude/latitude box reaches. */
export const tilesCovering = (
	[west, south, east, north]: TileBox,
	z: number,
): TileAddress[] => {
	const [minX, minY] = worldTile([west, north], z);
	const [maxX, maxY] = worldTile([east, south], z);
	const limit = 2 ** z - 1;
	const clamp = (value: number) =>
		Math.min(Math.max(Math.floor(value), 0), limit);
	const tiles: TileAddress[] = [];
	for (let x = clamp(minX); x <= clamp(maxX); x += 1)
		for (let y = clamp(minY); y <= clamp(maxY); y += 1)
			tiles.push({ z, x, y });
	return tiles;
};

type Point = [number, number];

/**
 * Sutherland-Hodgman against one edge of the tile square.
 *
 * Chosen over a general polygon clipper because it is exactly determined by the
 * two coordinates of a segment: the same segment always yields the same cut,
 * whichever area is being clipped. A general clipper decides intersections from
 * the whole polygon and can place the same border's cut differently on each
 * side of it.
 */
const clipToEdge = (
	ring: Point[],
	inside: (point: Point) => boolean,
	cross: (from: Point, to: Point) => Point,
): Point[] => {
	const out: Point[] = [];
	for (let i = 0; i < ring.length; i += 1) {
		const from = ring[i]!;
		const to = ring[(i + 1) % ring.length]!;
		const fromIn = inside(from);
		const toIn = inside(to);
		if (fromIn) out.push(from);
		if (fromIn !== toIn) out.push(cross(from, to));
	}
	return out;
};

const at = (from: Point, to: Point, ratio: number): Point => [
	Math.round(from[0] + (to[0] - from[0]) * ratio),
	Math.round(from[1] + (to[1] - from[1]) * ratio),
];

/**
 * One ring cut to the tile square and its buffer. Returns an empty ring when
 * nothing of it is inside, which is how a feature leaves a tile it never
 * reaches.
 */
export const clipRing = (ring: Point[], buffer = TILE_BUFFER): Point[] => {
	const low = -buffer;
	const high = TILE_EXTENT + buffer;
	let clipped =
		ring.length > 1 &&
		ring[0]![0] === ring[ring.length - 1]![0] &&
		ring[0]![1] === ring[ring.length - 1]![1]
			? ring.slice(0, -1)
			: ring.slice();
	const edges: Array<
		[(point: Point) => boolean, (from: Point, to: Point) => Point]
	> = [
		[
			(point) => point[0] >= low,
			(from, to) => at(from, to, (low - from[0]) / (to[0] - from[0])),
		],
		[
			(point) => point[0] <= high,
			(from, to) => at(from, to, (high - from[0]) / (to[0] - from[0])),
		],
		[
			(point) => point[1] >= low,
			(from, to) => at(from, to, (low - from[1]) / (to[1] - from[1])),
		],
		[
			(point) => point[1] <= high,
			(from, to) => at(from, to, (high - from[1]) / (to[1] - from[1])),
		],
	];
	for (const [inside, cross] of edges) {
		if (clipped.length === 0) return [];
		clipped = clipToEdge(clipped, inside, cross);
	}
	// Consecutive duplicates come from cutting a segment that ends exactly on
	// the boundary, and say nothing about the shape.
	const trimmed = clipped.filter(
		(point, index) =>
			index === 0 ||
			point[0] !== clipped[index - 1]![0] ||
			point[1] !== clipped[index - 1]![1],
	);
	return trimmed.length < 3 ? [] : trimmed;
};

/** Twice the signed area, positive when the ring runs clockwise on the screen. */
export const signedArea = (ring: Point[]) => {
	let total = 0;
	for (let i = 0; i < ring.length; i += 1) {
		const from = ring[i]!;
		const to = ring[(i + 1) % ring.length]!;
		total += from[0] * to[1] - to[0] * from[1];
	}
	return total;
};

/**
 * Wound the way a vector tile requires: an outer ring clockwise on the screen,
 * a hole anticlockwise. Source releases are not consistent about this, and a
 * renderer reads a wrongly wound outer ring as a hole.
 */
export const wind = (ring: Point[], outer: boolean): Point[] =>
	signedArea(ring) >= 0 === outer ? ring : [...ring].reverse();
