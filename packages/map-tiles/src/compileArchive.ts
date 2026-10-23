import { featureIds } from "./featureIds";
import { buildArchive, type ArchiveTile, type Gzip } from "./pmtiles";
import type { GeometryTier } from "./simplifyGeometry";
import { tileBounds, tilesCovering, type TileBox } from "./tileGrid";
import {
	boundsOf,
	buildTile,
	featuresByTile,
	MAX_ZOOM,
	MIN_ZOOM,
	ZOOM_TIERS,
	type MapFeature,
} from "./tileset";
import type { GeoJsonGeometry } from "./types";

export const LAYER_NAME = "boundaries";
export type ArchiveOptions = {
	name: string;
	description: string;
	attribution: string;
	names: Map<string, string>;
	gzip: Gzip;
};

/** One archive writer for shared-arc tiers and already compiled polygons. */
export function compileArchive(
	areasForTier: (tier: GeometryTier) => Map<string, GeoJsonGeometry>,
	ids: Map<string, number>,
	options: ArchiveOptions,
) {
	const areas = areasForTier(ZOOM_TIERS[0]!.tier);
	if (!areas.size)
		throw new Error(`No geometry is available for ${options.name}.`);

	const bounds: TileBox = [Infinity, Infinity, -Infinity, -Infinity];
	const tiles: ArchiveTile[] = [];
	for (const band of ZOOM_TIERS) {
		const areas = areasForTier(band.tier);

		const features: MapFeature[] = [...areas].map(([code, geometry]) => {
			const box = boundsOf(geometry);
			bounds[0] = Math.min(bounds[0], box[0]);
			bounds[1] = Math.min(bounds[1], box[1]);
			bounds[2] = Math.max(bounds[2], box[2]);
			bounds[3] = Math.max(bounds[3], box[3]);
			return {
				id: ids.get(code)!,
				code,
				name: options.names.get(code) ?? code,
				geometry,
				bounds: box,
			};
		});
		for (let zoom = band.minZoom; zoom <= band.maxZoom; zoom += 1) {
			const reaching = featuresByTile(features, zoom);
			for (const address of tilesCovering(bounds, zoom)) {
				const body = buildTile(
					LAYER_NAME,
					reaching.get(address.x * 2 ** zoom + address.y) ?? [],
					address,
					tileBounds(address),
				);
				if (body)
					tiles.push({
						z: address.z,
						x: address.x,
						y: address.y,
						body,
					});
			}
		}
	}

	const archive = buildArchive(tiles, {
		minZoom: MIN_ZOOM,
		maxZoom: MAX_ZOOM,
		bounds,
		centre: [
			(bounds[0] + bounds[2]) / 2,
			(bounds[1] + bounds[3]) / 2,
			ZOOM_TIERS[0]!.maxZoom,
		],
		gzip: options.gzip,
		// A renderer reads the archive alone, so what it needs to draw and to
		// cite travels inside it.
		metadata: {
			name: options.name,
			description: options.description,
			attribution: options.attribution,
			format: "pbf",
			vector_layers: [
				{
					id: LAYER_NAME,
					description: options.description,
					minzoom: MIN_ZOOM,
					maxzoom: MAX_ZOOM,
					fields: {
						code: "String",
						name: "String",
					},
				},
			],
		},
	});

	return { archive, bounds, tileCount: tiles.length, ids };
}

/** Tile the private compiled polygons without another generalisation pass. */
export const compilePolygonArchive = (
	areas: Map<string, GeoJsonGeometry>,
	options: ArchiveOptions,
) => compileArchive(() => areas, featureIds([...areas.keys()]), options);
