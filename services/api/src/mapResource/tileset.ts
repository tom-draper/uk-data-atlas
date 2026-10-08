import type { Coordinate } from "../areaContainment";
import type { GeoJsonGeometry } from "../areaGeometry";
import type { GeometryTier } from "../simplifyGeometry";
import {
	clipWorldRing,
	toWorldRing,
	wind,
	worldTile,
	type TileAddress,
	type TileBox,
	type WorldRing,
} from "./tileGrid";
import { encodeTile, type TileFeature } from "./vectorTile";

/**
 * Which generalisation a zoom level is drawn from, and the tiles themselves.
 *
 * A tile is 4,096 units across whatever ground it covers, so detail finer than
 * one unit cannot be drawn and only costs bytes. At the United Kingdom's
 * latitudes a unit is about 5,750 metres at zoom 0 and halves with every zoom,
 * so each tier is used down to the zoom where its tolerance stops being worth
 * carrying. The pyramid stops at zoom 12, where a unit is roughly 1.4 metres
 * and the `high` tier is already finer than the grid; a renderer over-zooms
 * past it rather than the resource storing sixteen times the tiles to say the
 * same thing.
 */
export const ZOOM_TIERS: ReadonlyArray<{
	minZoom: number;
	maxZoom: number;
	tier: GeometryTier;
}> = [
	{ minZoom: 0, maxZoom: 5, tier: "low" },
	{ minZoom: 6, maxZoom: 9, tier: "medium" },
	{ minZoom: 10, maxZoom: 12, tier: "high" },
];

export const MIN_ZOOM = ZOOM_TIERS[0]!.minZoom;
export const MAX_ZOOM = ZOOM_TIERS[ZOOM_TIERS.length - 1]!.maxZoom;

export const tierForZoom = (zoom: number): GeometryTier => {
	const band = ZOOM_TIERS.find(
		(entry) => zoom >= entry.minZoom && zoom <= entry.maxZoom,
	);
	if (!band) throw new Error(`No tier is published for zoom ${zoom}.`);
	return band.tier;
};

/** One area as a map feature: what a tile carries, and where it is. */
export type MapFeature = {
	/**
	 * Stable for the life of the resource. Vector tile ids are integers and a
	 * renderer holds per-feature state against them, so a join table publishes
	 * this alongside the code rather than leaving it to the encoder.
	 */
	id: number;
	code: string;
	name: string;
	geometry: GeoJsonGeometry;
	bounds: TileBox;
	/**
	 * The geometry's rings projected for tiling, filled in the first time the
	 * feature reaches a tile. A release is cut into thousands of tiles, and
	 * projecting every vertex again for each one was most of the cost of
	 * tiling a coastline. Held here, they go when the zoom band's features do.
	 */
	projected?: WorldRing[][];
};

const polygonsOf = (geometry: GeoJsonGeometry): Coordinate[][][] => {
	if (geometry.type === "GeometryCollection")
		return (geometry.geometries ?? []).flatMap(polygonsOf);
	const polygons =
		geometry.type === "Polygon"
			? [geometry.coordinates]
			: geometry.type === "MultiPolygon"
				? geometry.coordinates
				: [];
	return Array.isArray(polygons) ? (polygons as Coordinate[][][]) : [];
};

export const boundsOf = (geometry: GeoJsonGeometry): TileBox => {
	let west = Infinity;
	let south = Infinity;
	let east = -Infinity;
	let north = -Infinity;
	for (const polygon of polygonsOf(geometry))
		for (const ring of polygon)
			for (const [longitude, latitude] of ring) {
				west = Math.min(west, longitude!);
				east = Math.max(east, longitude!);
				south = Math.min(south, latitude!);
				north = Math.max(north, latitude!);
			}
	return [west, south, east, north];
};

const overlaps = (
	[west, south, east, north]: TileBox,
	[otherWest, otherSouth, otherEast, otherNorth]: TileBox,
) =>
	west <= otherEast &&
	otherWest <= east &&
	south <= otherNorth &&
	otherSouth <= north;

/**
 * The features that can reach each tile at one zoom, keyed by
 * `x * 2^zoom + y`, each list in the order it was given. Testing every area
 * against every tile was most of the cost of tiling a release of small areas:
 * output areas are 190,000 features over thousands of tiles. A tile's buffer
 * reaches less than a tile beyond it, so a feature can only reach the tiles
 * its own extent covers and their neighbours; tileFeatures still decides
 * exactly which do.
 */
export const featuresByTile = (features: MapFeature[], zoom: number) => {
	const byTile = new Map<number, MapFeature[]>();
	const size = 2 ** zoom;
	for (const feature of features) {
		const [west, south, east, north] = feature.bounds;
		const [minX, minY] = worldTile([west, north], zoom);
		const [maxX, maxY] = worldTile([east, south], zoom);
		if (![minX, minY, maxX, maxY].every(Number.isFinite)) continue;
		const lastX = Math.min(Math.floor(maxX) + 1, size - 1);
		const lastY = Math.min(Math.floor(maxY) + 1, size - 1);
		for (let x = Math.max(Math.floor(minX) - 1, 0); x <= lastX; x += 1)
			for (
				let y = Math.max(Math.floor(minY) - 1, 0);
				y <= lastY;
				y += 1
			) {
				const key = x * size + y;
				const reaching = byTile.get(key);
				if (reaching) reaching.push(feature);
				else byTile.set(key, [feature]);
			}
	}
	return byTile;
};

/**
 * What is left of each area inside one tile.
 *
 * A polygon whose outer ring falls outside the tile is not in the tile at all,
 * and neither are its holes. A hole that leaves while its outer ring stays is
 * cut to the tile like any other ring.
 */
export const tileFeatures = (
	features: MapFeature[],
	address: TileAddress,
	tileBounds: TileBox,
): TileFeature[] => {
	const inTile: TileFeature[] = [];
	for (const feature of features) {
		if (!overlaps(feature.bounds, tileBounds)) continue;
		feature.projected ??= polygonsOf(feature.geometry).map((polygon) =>
			polygon.map(toWorldRing),
		);
		const rings: Array<Array<[number, number]>> = [];
		for (const polygon of feature.projected) {
			const [outer, ...holes] = polygon;
			if (!outer) continue;
			const clipped = clipWorldRing(outer, address);
			if (clipped.length === 0) continue;
			rings.push(wind(clipped, true));
			for (const hole of holes) {
				const cut = clipWorldRing(hole, address);
				if (cut.length > 0) rings.push(wind(cut, false));
			}
		}
		if (rings.length > 0)
			inTile.push({
				id: feature.id,
				rings,
				properties: { code: feature.code, name: feature.name },
			});
	}
	return inTile;
};

/** One tile, or nothing when no area reaches it. */
export const buildTile = (
	layerName: string,
	features: MapFeature[],
	address: TileAddress,
	tileBounds: TileBox,
): Buffer | undefined => {
	const inTile = tileFeatures(features, address, tileBounds);
	return inTile.length === 0 ? undefined : encodeTile(layerName, inTile);
};
