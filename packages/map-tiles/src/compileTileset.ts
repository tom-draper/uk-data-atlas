import { decomposeArcs } from "./arcs";
import { featureIds } from "./featureIds";
import { buildArchive, type ArchiveTile } from "./pmtiles";
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
import { compileTiers } from "./topologyTiers";
import type { GeoJsonGeometry } from "./types";

/** The one vector layer every archive carries. */
export const LAYER_NAME = "boundaries";

export type TilesetOptions = {
	/** Names the release in the archive and in errors, e.g. `ward/2024-05-uk-bgc`. */
	name: string;
	description: string;
	attribution: string;
	/** Each area's name, for the label a renderer draws. Falls back to its code. */
	names: Map<string, string>;
};

export type CompiledTileset = {
	archive: Buffer;
	arcCount: number;
	bounds: TileBox;
	tileCount: number;
	/** Each feature's id, the same at every zoom and in every flat download. */
	ids: Map<string, number>;
	/** Each tier's generalised areas, for downloads that must match the tiles. */
	compiledTiers: ReturnType<typeof compileTiers>;
	tiers: Array<{
		tier: GeometryTier;
		toleranceM: number;
		coordinates: number;
		refinedArcs: number;
	}>;
	zooms: Array<{
		minZoom: number;
		maxZoom: number;
		tier: GeometryTier;
		toleranceM: number;
	}>;
};

/**
 * Tile one boundary release into a PMTiles archive. Borders are decomposed into
 * shared arcs and generalised once per tier, so neighbouring areas never gap or
 * overlap at any zoom. Throws when the areas are not a coverage, since such a
 * release cannot be tiled without drawing one area over another.
 */
export const compileTileset = (
	areas: Map<string, GeoJsonGeometry>,
	options: TilesetOptions,
): CompiledTileset => {
	if (areas.size === 0)
		throw new Error(`No geometry is available for ${options.name}.`);
	const topology = decomposeArcs(areas);
	if (topology.overlappingEdges > 0) {
		const codes = topology.overlappingAreaCodes;
		const sample = codes.slice(0, 20).join(", ");
		const remaining =
			codes.length > 20 ? `, ... (${codes.length - 20} more)` : "";
		throw new Error(
			`${options.name} is not a coverage: ${topology.overlappingEdges} edges lie on more than two areas, so it cannot be tiled without drawing one over another. Offending area codes: ${sample}${remaining}.`,
		);
	}

	// A feature keeps its number at every zoom, and the number comes from
	// sorted code order rather than the order the geometry file happens to
	// list its features in, so a join table can work it out from the codes
	// alone instead of having to be told it.
	const ids = featureIds([...areas.keys()]);
	const compiledTiers = compileTiers(topology);

	const bounds: TileBox = [Infinity, Infinity, -Infinity, -Infinity];
	const tiles: ArchiveTile[] = [];
	const tiers: CompiledTileset["tiers"] = [];
	for (const band of ZOOM_TIERS) {
		const compiled = compiledTiers.get(band.tier)!;
		tiers.push({
			tier: band.tier,
			toleranceM: compiled.toleranceM,
			coordinates: compiled.verticesAfter,
			refinedArcs: compiled.refinedArcs,
		});
		const features: MapFeature[] = [...compiled.areas].map(
			([code, geometry]) => {
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
			},
		);
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

	return {
		archive,
		arcCount: topology.arcs.length,
		bounds,
		tileCount: tiles.length,
		ids,
		compiledTiers,
		tiers,
		zooms: ZOOM_TIERS.map((band) => ({
			minZoom: band.minZoom,
			maxZoom: band.maxZoom,
			tier: band.tier,
			toleranceM: tiers.find((entry) => entry.tier === band.tier)!
				.toleranceM,
		})),
	};
};
