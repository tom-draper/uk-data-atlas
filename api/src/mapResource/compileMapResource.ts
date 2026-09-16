import { createHash } from "node:crypto";
import type { AreaGeometryCache } from "../areaGeometry";
import type { GeometryTier } from "../simplifyGeometry";
import { decomposeArcs } from "./arcs";
import { compileTier, TOPOLOGY_METHOD } from "./topologyTiers";
import { tileBounds, tilesCovering, type TileBox } from "./tileGrid";
import {
	boundsOf,
	buildTile,
	MAX_ZOOM,
	MIN_ZOOM,
	ZOOM_TIERS,
	type MapFeature,
} from "./tileset";
import { buildArchive, type ArchiveTile } from "./pmtiles";

/**
 * One boundary release compiled into everything a map needs: the archive of
 * tiles, and the descriptor that says what they are and what they were made
 * from.
 *
 * The descriptor is the only document a client has to read. It names the
 * publisher file behind the shapes, the hash of the archive built from it and
 * the terms the generalisation was done on, so a drawing can be traced back to
 * its source without trusting this API.
 */

export const LAYER_NAME = "boundaries";

const sha256 = (content: Buffer) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

export type MapResourceDescriptor = {
	id: string;
	geography: string;
	boundaryRelease: string;
	title: string;
	/** Borders are compiled once and shared, not redrawn for each area. */
	topology: "shared-arc";
	areaCount: number;
	arcCount: number;
	bounds: TileBox;
	tiles: {
		artifact: string;
		href: string;
		format: "pmtiles-3";
		tileFormat: "mvt-2.1";
		layer: string;
		minZoom: number;
		maxZoom: number;
		zooms: Array<{
			minZoom: number;
			maxZoom: number;
			tier: GeometryTier;
			toleranceM: number;
		}>;
		tileCount: number;
		bytes: number;
		contentHash: string;
	};
	tiers: Array<{
		tier: GeometryTier;
		toleranceM: number;
		coordinates: number;
		refinedArcs: number;
	}>;
	generalisation: typeof TOPOLOGY_METHOD;
	geometrySource: Record<string, unknown>;
	attribution: {
		text: string;
		publisher: string;
		sourceUrl: string;
		licence: { name: string; url?: string };
		href: string;
	};
};

export type BoundaryReleaseSummary = {
	id: string;
	geography: string;
	title: string;
	source: {
		publisher: string;
		url: string;
		licence: { name: string; url?: string };
	};
};

export const compileMapResource = (
	cache: AreaGeometryCache,
	release: BoundaryReleaseSummary,
	/** Each area's name in this release, for the label a renderer draws. */
	names: Map<string, string>,
	artifact: string,
): { archive: Buffer; descriptor: MapResourceDescriptor } => {
	const { geography, id: boundaryRelease } = release;
	const areas = new Map(
		cache.codes(geography, boundaryRelease).flatMap((code) => {
			const geometry = cache.get(geography, boundaryRelease, code);
			return geometry ? [[code, geometry] as const] : [];
		}),
	);
	if (areas.size === 0)
		throw new Error(
			`No geometry is available for ${geography}/${boundaryRelease}.`,
		);
	const topology = decomposeArcs(areas);
	if (topology.overlappingEdges > 0)
		throw new Error(
			`${geography}/${boundaryRelease} is not a coverage: ${topology.overlappingEdges} edges lie on more than two areas, so it cannot be tiled without drawing one over another.`,
		);

	// Codes are numbered once, in the order the release publishes them, and a
	// feature keeps that number at every zoom.
	const numbered = new Map(
		[...areas.keys()].map((code, at) => [code, at + 1]),
	);

	const bounds: TileBox = [Infinity, Infinity, -Infinity, -Infinity];
	const tiles: ArchiveTile[] = [];
	const tiers: MapResourceDescriptor["tiers"] = [];
	for (const band of ZOOM_TIERS) {
		const compiled = compileTier(topology, band.tier);
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
					id: numbered.get(code)!,
					code,
					name: names.get(code) ?? code,
					geometry,
					bounds: box,
				};
			},
		);
		for (let zoom = band.minZoom; zoom <= band.maxZoom; zoom += 1)
			for (const address of tilesCovering(bounds, zoom)) {
				const body = buildTile(
					LAYER_NAME,
					features,
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

	const attribution = {
		text: `Contains ${release.source.publisher} data, ${release.source.licence.name}`,
		publisher: release.source.publisher,
		sourceUrl: release.source.url,
		licence: release.source.licence,
		href: `/v1/attribution?boundaryReleases=${geography}/${boundaryRelease}`,
	};
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
		// cite travels inside it as well as in the descriptor.
		metadata: {
			name: `${geography}/${boundaryRelease}`,
			description: release.title,
			attribution: attribution.text,
			format: "pbf",
			vector_layers: [
				{
					id: LAYER_NAME,
					description: release.title,
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
		descriptor: {
			id: `${geography}/${boundaryRelease}`,
			geography,
			boundaryRelease,
			title: release.title,
			topology: "shared-arc",
			areaCount: areas.size,
			arcCount: topology.arcs.length,
			bounds,
			tiles: {
				artifact,
				href: `/v1/map-resources/${geography}/${boundaryRelease}.pmtiles`,
				format: "pmtiles-3",
				tileFormat: "mvt-2.1",
				layer: LAYER_NAME,
				minZoom: MIN_ZOOM,
				maxZoom: MAX_ZOOM,
				zooms: ZOOM_TIERS.map((band) => ({
					minZoom: band.minZoom,
					maxZoom: band.maxZoom,
					tier: band.tier,
					toleranceM: tiers.find((entry) => entry.tier === band.tier)!
						.toleranceM,
				})),
				tileCount: tiles.length,
				bytes: archive.length,
				contentHash: sha256(archive),
			},
			tiers,
			generalisation: TOPOLOGY_METHOD,
			geometrySource: cache.provenance(
				geography,
				boundaryRelease,
			) as unknown as Record<string, unknown>,
			attribution,
		},
	};
};
