/**
 * A Mapbox Vector Tile writer, enough of it to publish a boundary release.
 *
 * The format is protocol buffers, and the few field types a tile needs are
 * written here rather than pulled in as a dependency: varints, length-delimited
 * bytes, and packed repeated uint32 for the geometry commands. Only what a
 * polygon layer uses is implemented, so an unsupported value type is refused
 * rather than silently dropped.
 *
 * Specification: Mapbox Vector Tile 2.1. Field numbers below are that schema's.
 */

/** Tile-local coordinates run 0 to `extent` across the tile, y downwards. */
export const TILE_EXTENT = 4096;

const varint = (value: number, into: number[]) => {
	let rest = value;
	while (rest > 0x7f) {
		into.push((rest & 0x7f) | 0x80);
		rest = Math.floor(rest / 128);
	}
	into.push(rest);
};

const tag = (field: number, wire: number, into: number[]) =>
	varint(field * 8 + wire, into);

const bytes = (field: number, value: number[], into: number[]) => {
	tag(field, 2, into);
	varint(value.length, into);
	for (const byte of value) into.push(byte);
};

const string = (field: number, value: string, into: number[]) =>
	bytes(field, [...Buffer.from(value, "utf8")], into);

const uint32 = (field: number, value: number, into: number[]) => {
	tag(field, 0, into);
	varint(value, into);
};

/** Signed tile coordinates travel zigzagged, so a small negative stays small. */
const zigzag = (value: number) => (value << 1) ^ (value >> 31);

const MOVE_TO = 1;
const LINE_TO = 2;
const CLOSE_PATH = 7;
const command = (id: number, count: number) => id | (count << 3);

export type TileFeature = {
	/** Stable within the resource, so a renderer can hold state against it. */
	id: number;
	/** Rings in tile coordinates: the outer ring first, then any holes. */
	rings: Array<Array<[number, number]>>;
	properties: Record<string, string | number>;
};

/**
 * The geometry commands for one polygon feature.
 *
 * Every ring is a MoveTo to its first point, a LineTo through the rest and a
 * ClosePath, with each coordinate written as the step from the one before it.
 * The closing repeat of the first coordinate is dropped: ClosePath is what
 * closes a ring here.
 */
const polygonGeometry = (rings: Array<Array<[number, number]>>) => {
	const geometry: number[] = [];
	let x = 0;
	let y = 0;
	for (const ring of rings) {
		const points =
			ring.length > 1 &&
			ring[0]![0] === ring[ring.length - 1]![0] &&
			ring[0]![1] === ring[ring.length - 1]![1]
				? ring.slice(0, -1)
				: ring;
		if (points.length < 3) continue;
		geometry.push(command(MOVE_TO, 1));
		geometry.push(zigzag(points[0]![0] - x), zigzag(points[0]![1] - y));
		x = points[0]![0];
		y = points[0]![1];
		geometry.push(command(LINE_TO, points.length - 1));
		for (const [pointX, pointY] of points.slice(1)) {
			geometry.push(zigzag(pointX - x), zigzag(pointY - y));
			x = pointX;
			y = pointY;
		}
		geometry.push(command(CLOSE_PATH, 1));
	}
	return geometry;
};

const packed = (field: number, values: number[], into: number[]) => {
	const payload: number[] = [];
	for (const value of values) varint(value, payload);
	bytes(field, payload, into);
};

const value = (entry: string | number, into: number[]) => {
	if (typeof entry === "string") return string(1, entry, into);
	if (!Number.isInteger(entry)) {
		// double_value, field 3, wire type 1: eight little-endian bytes.
		tag(3, 1, into);
		const buffer = Buffer.alloc(8);
		buffer.writeDoubleLE(entry);
		for (const byte of buffer) into.push(byte);
		return;
	}
	if (entry < 0) {
		// sint_value, field 6, zigzagged like a tile coordinate.
		tag(6, 0, into);
		varint(zigzag(entry), into);
		return;
	}
	// uint_value, field 5.
	tag(5, 0, into);
	varint(entry, into);
};

/**
 * One layer of polygon features as a complete tile.
 *
 * Property keys and values are pooled across the layer, which is what keeps a
 * tile small when every feature carries the same handful of fields, and each
 * feature refers to them by position.
 */
export const encodeTile = (
	layerName: string,
	features: TileFeature[],
): Buffer => {
	const keys: string[] = [];
	const keyIndex = new Map<string, number>();
	const values: Array<string | number> = [];
	const valueIndex = new Map<string, number>();
	const layer: number[] = [];

	// Written before the features that refer to them only in the sense that
	// the pools are built first; protobuf fields may appear in any order.
	const featureBlocks: number[][] = [];
	for (const feature of features) {
		const geometry = polygonGeometry(feature.rings);
		// Nothing in this tile encloses anything, so the feature is not in it.
		if (geometry.length === 0) continue;
		const block: number[] = [];
		tag(1, 0, block);
		varint(feature.id, block);
		const tags: number[] = [];
		for (const [key, entry] of Object.entries(feature.properties)) {
			let atKey = keyIndex.get(key);
			if (atKey === undefined) {
				atKey = keys.length;
				keys.push(key);
				keyIndex.set(key, atKey);
			}
			const pooled = `${typeof entry}:${entry}`;
			let atValue = valueIndex.get(pooled);
			if (atValue === undefined) {
				atValue = values.length;
				values.push(entry);
				valueIndex.set(pooled, atValue);
			}
			tags.push(atKey, atValue);
		}
		if (tags.length > 0) packed(2, tags, block);
		uint32(3, 3, block); // GeomType.POLYGON
		packed(4, geometry, block);
		featureBlocks.push(block);
	}

	string(1, layerName, layer);
	for (const block of featureBlocks) bytes(2, block, layer);
	for (const key of keys) string(3, key, layer);
	for (const entry of values) {
		const block: number[] = [];
		value(entry, block);
		bytes(4, block, layer);
	}
	uint32(5, TILE_EXTENT, layer);
	uint32(15, 2, layer); // version

	const tile: number[] = [];
	bytes(3, layer, tile);
	return Buffer.from(tile);
};
