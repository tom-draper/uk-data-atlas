import { createHash } from "node:crypto";
import type { AreaGeometryCache } from "../areaGeometry";
import { GEOMETRY_TIERS, type GeometryTier } from "../simplifyGeometry";
import { decomposeArcs } from "./arcs";
import { buildGeoJson } from "./geoJson";
import { buildGeoParquet } from "./geoParquet";
import {
	compileTier,
	TOPOLOGY_METHOD,
	type TierGeometry,
} from "./topologyTiers";
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
import { releaseKey } from "../geographyKeys";

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

/**
 * A map resource numbers its areas so a renderer can hold state against them,
 * because a vector tile feature id must be an integer. The number is the
 * code's place in sorted order, which anything holding the same set of codes
 * can reproduce without reading the tiles.
 */
export const featureIds = (codes: string[]) =>
	new Map([...codes].sort().map((code, index) => [code, index + 1] as const));

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
	/**
	 * The flat form: every area of one tier as a whole-release download, as
	 * GeoParquet and as GeoJSON, with the ids the tiles and join tables use.
	 * Every tier is published, `full` included, because a warehouse chooses
	 * its own detail.
	 */
	features: Array<{
		tier: GeometryTier;
		toleranceM: number;
		format: "geoparquet-1.1" | "geojson";
		artifact: string;
		href: string;
		rowCount: number;
		coordinates: number;
		/** The size and hash of the download itself, once any encoding is undone. */
		bytes: number;
		contentHash: string;
		/** Present when the file is stored gzipped: its size as stored. */
		gzipBytes?: number;
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
): {
	archive: Buffer;
	features: Array<{ artifact: string; body: Buffer }>;
	descriptor: MapResourceDescriptor;
} => {
	const { geography, id: boundaryRelease } = release;
	// Only the release's own areas. A release can take its shapes from a
	// larger publisher file, as Welsh 2011 LSOAs come from the England and
	// Wales one, and the rest of that file is not this release.
	const areas = new Map(
		cache
			.codes(geography, boundaryRelease)
			.filter((code) => names.size === 0 || names.has(code))
			.flatMap((code) => {
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

	// A feature keeps its number at every zoom, and the number comes from
	// sorted code order rather than the order the geometry file happens to
	// list its features in, so a join table can work it out from the codes
	// alone instead of having to be told it.
	const numbered = featureIds([...areas.keys()]);

	// Each tier is generalised once and used for both forms, so a feature in
	// the flat download and the same feature in a tile are the same shape.
	const compiledTiers = new Map<GeometryTier, TierGeometry>(
		(Object.keys(GEOMETRY_TIERS) as GeometryTier[]).map((tier) => [
			tier,
			compileTier(topology, tier),
		]),
	);

	const bounds: TileBox = [Infinity, Infinity, -Infinity, -Infinity];
	const tiles: ArchiveTile[] = [];
	const tiers: MapResourceDescriptor["tiers"] = [];
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
	const id = releaseKey(geography, boundaryRelease);
	const features = [...compiledTiers].flatMap(([tier, compiled]) => {
		const rows = [...compiled.areas].map(([code, geometry]) => ({
			id: numbered.get(code)!,
			code,
			name: names.get(code) ?? code,
			geometry,
		}));
		const parquet = buildGeoParquet(rows, {
			mapResource: id,
			tier,
			toleranceM: compiled.toleranceM,
			topology: "shared-arc",
			attribution: attribution.text,
			geometrySourceInputHash:
				cache.provenance(geography, boundaryRelease).inputHash ?? null,
		});
		const geoJson = buildGeoJson(rows, {
			mapResource: id,
			tier,
			attribution: attribution.text,
		});
		const base = {
			tier,
			toleranceM: compiled.toleranceM,
			rowCount: compiled.areas.size,
			coordinates: compiled.verticesAfter,
		};
		return [
			{
				entry: {
					...base,
					format: "geoparquet-1.1" as const,
					artifact: artifact.replace(
						/\.pmtiles$/,
						`-${tier}.parquet`,
					),
					href: `/v1/map-resources/${id}/features?tier=${tier}`,
					bytes: parquet.length,
					contentHash: sha256(parquet),
				},
				body: parquet,
			},
			{
				entry: {
					...base,
					format: "geojson" as const,
					artifact: artifact.replace(
						/\.pmtiles$/,
						`-${tier}.geojson.gz`,
					),
					href: `/v1/map-resources/${id}/features?tier=${tier}&format=geojson`,
					bytes: geoJson.bytes,
					contentHash: geoJson.contentHash,
					gzipBytes: geoJson.gzipped.length,
				},
				body: geoJson.gzipped,
			},
		];
	});
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
		features: features.map(({ entry, body }) => ({
			artifact: entry.artifact,
			body,
		})),
		descriptor: {
			id,
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
			features: features.map(({ entry }) => entry),
			generalisation: TOPOLOGY_METHOD,
			geometrySource: cache.provenance(
				geography,
				boundaryRelease,
			) as unknown as Record<string, unknown>,
			attribution,
		},
	};
};
