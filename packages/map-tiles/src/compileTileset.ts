import { featureIds } from "./featureIds.ts";
import { decomposeArcs } from "./arcs.ts";
import { compileArchive, type ArchiveOptions } from "./compileArchive.ts";
import type { GeometryTier } from "./simplifyGeometry.ts";
import type { TileBox } from "./tileGrid.ts";
import { ZOOM_TIERS } from "./tileset.ts";
import { compileTiers } from "./topologyTiers.ts";
import type { GeoJsonGeometry } from "./types.ts";
export { LAYER_NAME } from "./compileArchive.ts";
export type TilesetOptions = ArchiveOptions;

export class NonCoverageError extends Error {
	readonly edgeCount: number;
	readonly areaCodes: readonly string[];
	constructor(
		message: string,
		edgeCount: number,
		areaCodes: readonly string[],
	) {
		super(message);
		this.edgeCount = edgeCount;
		this.areaCodes = areaCodes;
	}
}

export type CompiledTileset = {
	archive: Uint8Array;
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
		throw new NonCoverageError(
			`${options.name} is not a coverage: ${topology.overlappingEdges} edges lie on more than two areas, so it cannot be tiled without drawing one over another. Offending area codes: ${sample}${remaining}.`,
			topology.overlappingEdges,
			codes,
		);
	}

	const compiledTiers = compileTiers(topology);
	const archive = compileArchive(
		(tier) => compiledTiers.get(tier)!.areas,
		featureIds([...areas.keys()]),
		options,
	);
	const tiers = ZOOM_TIERS.map((band) => {
		const compiled = compiledTiers.get(band.tier)!;
		return {
			tier: band.tier,
			toleranceM: compiled.toleranceM,
			coordinates: compiled.verticesAfter,
			refinedArcs: compiled.refinedArcs,
		};
	});
	return {
		...archive,
		arcCount: topology.arcs.length,
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
