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

/**
 * One axis of a zoom 0 world position as an integer inside one tile. Scaling
 * by a power of two is exact, so this is the same number worldTile gives at
 * the tile's own zoom: a caller can project a coordinate once and place it in
 * every tile from that.
 */
export const toTileUnits = (world: number, z: number, tile: number) =>
	Math.round((world * 2 ** z - tile) * TILE_EXTENT);

/** The same coordinate as integers inside one tile, y downwards from the top. */
export const toTileGrid = (
	coordinate: Coordinate,
	{ z, x, y }: TileAddress,
): [number, number] => {
	const [worldX, worldY] = worldTile(coordinate, 0);
	return [toTileUnits(worldX, z, x), toTileUnits(worldY, z, y)];
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

/** Sutherland-Hodgman against each edge in turn, then tidied. */
const clipToTile = (ring: Point[], buffer: number): Point[] => {
	const low = -buffer;
	const high = TILE_EXTENT + buffer;
	let clipped = ring;
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

/**
 * One ring cut to the tile square and its buffer. Returns an empty ring when
 * nothing of it is inside, which is how a feature leaves a tile it never
 * reaches.
 */
export const clipRing = (ring: Point[], buffer = TILE_BUFFER): Point[] =>
	clipToTile(
		ring.length > 1 &&
			ring[0]![0] === ring[ring.length - 1]![0] &&
			ring[0]![1] === ring[ring.length - 1]![1]
			? ring.slice(0, -1)
			: ring,
		buffer,
	);

/** Vertices per block in a WorldRing, each block with its own extent. */
const BLOCK = 32;

/**
 * A ring on the zoom 0 world grid, x and y interleaved, with its extent there
 * and the extent of each block of BLOCK vertices, as minimum x and y then
 * maximum x and y.
 */
export type WorldRing = {
	world: Float64Array;
	box: [minX: number, minY: number, maxX: number, maxY: number];
	blocks: Float64Array;
};

export const toWorldRing = (ring: Coordinate[]): WorldRing => {
	const world = new Float64Array(ring.length * 2);
	const blocks = new Float64Array(Math.ceil(ring.length / BLOCK) * 4);
	blocks.fill(Infinity);
	for (let block = 0; block < blocks.length; block += 4) {
		blocks[block + 2] = -Infinity;
		blocks[block + 3] = -Infinity;
	}
	ring.forEach((coordinate, index) => {
		const [x, y] = worldTile(coordinate, 0);
		world[index * 2] = x;
		world[index * 2 + 1] = y;
		const block = Math.floor(index / BLOCK) * 4;
		blocks[block] = Math.min(blocks[block]!, x);
		blocks[block + 1] = Math.min(blocks[block + 1]!, y);
		blocks[block + 2] = Math.max(blocks[block + 2]!, x);
		blocks[block + 3] = Math.max(blocks[block + 3]!, y);
	});
	const box: WorldRing["box"] = [Infinity, Infinity, -Infinity, -Infinity];
	for (let block = 0; block < blocks.length; block += 4) {
		box[0] = Math.min(box[0], blocks[block]!);
		box[1] = Math.min(box[1], blocks[block + 1]!);
		box[2] = Math.max(box[2], blocks[block + 2]!);
		box[3] = Math.max(box[3], blocks[block + 3]!);
	}
	return { world, box, blocks };
};

/** The first edge, in the order clipToTile cuts them, a point lies beyond. */
const INSIDE = 0;
const WEST = 1;
const EAST = 2;
const NORTH = 3;
const SOUTH = 4;
/** A block whose vertices are not all on the same side of the tile. */
const MIXED = 5;

const edgeOf = (tileX: number, tileY: number, low: number, high: number) =>
	tileX < low
		? WEST
		: tileX > high
			? EAST
			: tileY < low
				? NORTH
				: tileY > high
					? SOUTH
					: INSIDE;

/** The edge a whole block lies beyond, from its extent on the tile's grid. */
const blockEdge = (
	west: number,
	north: number,
	east: number,
	south: number,
	low: number,
	high: number,
) => {
	if (east < low) return WEST;
	if (west > high) return EAST;
	if (west < low || east > high) return MIXED;
	if (south < low) return NORTH;
	if (north > high) return SOUTH;
	return north < low || south > high ? MIXED : INSIDE;
};

// Reused from tile to tile: a coastline is placed in thousands of them.
let beyond = new Uint8Array(0);
let blockBeyond = new Uint8Array(0);

const edgeAt = (index: number) => {
	const edge = blockBeyond[(index / BLOCK) | 0]!;
	return edge === MIXED ? beyond[index]! : edge;
};

/**
 * clipRing for a ring toWorldRing has projected, placing it in the tile
 * itself, with the same result for far less work.
 *
 * Each vertex is coded by the first edge it lies beyond. A run of vertices
 * beyond the same edge reaches that edge's cut unchanged and still
 * consecutive, since none of its segments crosses an edge cut before it, and
 * the cut drops the whole run, keeping only where the segments into and out of
 * it cross. So only a run's first and last vertices can change the result,
 * and only those are placed and clipped: a coastline that leaves the tile
 * costs two points each time it does, rather than every vertex.
 *
 * Rounding never reorders values, so a block whose extent rounds wholly beyond
 * an edge has every vertex beyond it. Its vertices are coded together, and
 * only its two ends can be a run's first or last, so the rest are never
 * placed. A ring wholly beyond an edge is skipped outright.
 */
export const clipWorldRing = (
	{ world, box: [minX, minY, maxX, maxY], blocks }: WorldRing,
	{ z, x, y }: TileAddress,
	buffer = TILE_BUFFER,
): Point[] => {
	const low = -buffer;
	const high = TILE_EXTENT + buffer;
	if (
		toTileUnits(maxX, z, x) < low ||
		toTileUnits(minX, z, x) > high ||
		toTileUnits(maxY, z, y) < low ||
		toTileUnits(minY, z, y) > high
	)
		return [];

	const vertices = world.length / 2;
	const blockCount = blocks.length / 4;
	if (beyond.length < vertices) beyond = new Uint8Array(vertices);
	if (blockBeyond.length < blockCount)
		blockBeyond = new Uint8Array(blockCount);
	for (let block = 0; block < blockCount; block += 1) {
		// y runs downwards, so a block's least y is its northern edge.
		const edge = blockEdge(
			toTileUnits(blocks[block * 4]!, z, x),
			toTileUnits(blocks[block * 4 + 1]!, z, y),
			toTileUnits(blocks[block * 4 + 2]!, z, x),
			toTileUnits(blocks[block * 4 + 3]!, z, y),
			low,
			high,
		);
		blockBeyond[block] = edge;
		if (edge !== MIXED) continue;
		const end = Math.min((block + 1) * BLOCK, vertices);
		for (let index = block * BLOCK; index < end; index += 1)
			beyond[index] = edgeOf(
				toTileUnits(world[index * 2]!, z, x),
				toTileUnits(world[index * 2 + 1]!, z, y),
				low,
				high,
			);
	}

	// As clipRing does, a closing vertex that repeats the first is dropped.
	const count =
		vertices > 1 &&
		toTileUnits(world[0]!, z, x) ===
			toTileUnits(world[vertices * 2 - 2]!, z, x) &&
		toTileUnits(world[1]!, z, y) ===
			toTileUnits(world[vertices * 2 - 1]!, z, y)
			? vertices - 1
			: vertices;
	const kept: Point[] = [];
	for (let block = 0; block * BLOCK < count; block += 1) {
		const first = block * BLOCK;
		const last = Math.min(first + BLOCK, count) - 1;
		const uniform = blockBeyond[block] !== MIXED;
		for (let index = first; index <= last; index += 1) {
			// Between its ends, a block beyond one edge is all one run.
			if (
				uniform &&
				blockBeyond[block] !== INSIDE &&
				index !== first &&
				index !== last
			) {
				index = last - 1;
				continue;
			}
			const edge = edgeAt(index);
			if (
				edge === INSIDE ||
				edgeAt((index + count - 1) % count) !== edge ||
				edgeAt((index + 1) % count) !== edge
			)
				kept.push([
					toTileUnits(world[index * 2]!, z, x),
					toTileUnits(world[index * 2 + 1]!, z, y),
				]);
		}
	}
	return clipToTile(kept, buffer);
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
