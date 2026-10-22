import { gzipSync } from "node:zlib";
import type { AreaGeometryCache } from "../areaGeometry";
import type { GeometryTier } from "@uk-data-atlas/map-tiles/simplifyGeometry";
import { buildGeoJson } from "./geoJson";
import { buildGeoParquet } from "./geoParquet";
import {
	compileTileset,
	LAYER_NAME,
} from "@uk-data-atlas/map-tiles/compileTileset";
import type { TileBox } from "@uk-data-atlas/map-tiles/tileGrid";
import { MAX_ZOOM, MIN_ZOOM } from "@uk-data-atlas/map-tiles/tileset";
import { TOPOLOGY_METHOD } from "@uk-data-atlas/map-tiles/topologyTiers";
import { releaseKey } from "../geographyKeys";
import { sha256 } from "../contentHash";
import { buildFullDetailParquet, GEOJSON_TIERS } from "./fullDetail";

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

export { featureIds } from "@uk-data-atlas/map-tiles/featureIds";
export { LAYER_NAME };

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
	 * The flat form: every area of one tier as a whole-release download, with
	 * the ids the tiles and join tables use. Every tier is published as
	 * GeoParquet, `full` included, because a warehouse chooses its own detail;
	 * the coarser tiers a browser can hold are published as GeoJSON too.
	 */
	features: Array<{
		tier: GeometryTier;
		toleranceM: number;
		format: "geoparquet-1.1" | "geojson";
		/**
		 * The stored file. Absent for the `full` tier, which is built from the
		 * geometry store when it is asked for (see `fullDetail.ts`).
		 */
		artifact?: string;
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
	const name = `${geography}/${boundaryRelease}`;
	const attributionText = `Contains ${release.source.publisher} data, ${release.source.licence.name}`;
	const {
		archive: archiveBytes,
		arcCount,
		bounds,
		tileCount,
		ids: numbered,
		compiledTiers,
		tiers,
		zooms,
	} = compileTileset(areas, {
		name,
		description: release.title,
		attribution: attributionText,
		names,
		gzip: gzipSync,
	});
	const archive = Buffer.from(
		archiveBytes.buffer,
		archiveBytes.byteOffset,
		archiveBytes.byteLength,
	);

	const attribution = {
		text: attributionText,
		publisher: release.source.publisher,
		sourceUrl: release.source.url,
		licence: release.source.licence,
		href: `/v1/attribution?boundaryReleases=${geography}/${boundaryRelease}`,
	};
	const id = releaseKey(geography, boundaryRelease);
	type Download = {
		entry: MapResourceDescriptor["features"][number];
		body?: Buffer;
	};
	const features = [...compiledTiers].flatMap(
		([tier, compiled]): Download[] => {
			if (tier === "full") {
				const full = buildFullDetailParquet(
					cache,
					{
						geography,
						boundaryRelease,
						attribution: attribution.text,
						topology: "shared-arc",
					},
					names,
				);
				if (!full) return [];
				return [
					{
						entry: {
							tier,
							toleranceM: 0,
							rowCount: full.rowCount,
							coordinates: full.coordinates,
							format: "geoparquet-1.1",
							href: `/v1/map-resources/${id}/features?tier=${tier}`,
							bytes: full.body.length,
							contentHash: full.contentHash,
						},
					},
				];
			}
			const rows = [...compiled.areas].map(([code, geometry]) => ({
				id: numbered.get(code)!,
				code,
				name: names.get(code) ?? code,
				geometry,
			}));
			const base = {
				tier,
				toleranceM: compiled.toleranceM,
				rowCount: compiled.areas.size,
				coordinates: compiled.verticesAfter,
			};
			const parquet = buildGeoParquet(rows, {
				mapResource: id,
				tier,
				toleranceM: compiled.toleranceM,
				topology: "shared-arc",
				attribution: attribution.text,
				geometrySourceInputHash:
					cache.provenance(geography, boundaryRelease).inputHash ??
					null,
			});
			const downloads: Download[] = [
				{
					entry: {
						...base,
						format: "geoparquet-1.1",
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
			];
			if (!GEOJSON_TIERS.includes(tier)) return downloads;
			const geoJson = buildGeoJson(rows, {
				mapResource: id,
				tier,
				attribution: attribution.text,
			});
			downloads.push({
				entry: {
					...base,
					format: "geojson",
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
			});
			return downloads;
		},
	);
	return {
		archive,
		features: features.flatMap(({ entry, body }) =>
			entry.artifact && body ? [{ artifact: entry.artifact, body }] : [],
		),
		descriptor: {
			id,
			geography,
			boundaryRelease,
			title: release.title,
			topology: "shared-arc",
			areaCount: areas.size,
			arcCount,
			bounds,
			tiles: {
				artifact,
				href: `/v1/map-resources/${geography}/${boundaryRelease}.pmtiles`,
				format: "pmtiles-3",
				tileFormat: "mvt-2.1",
				layer: LAYER_NAME,
				minZoom: MIN_ZOOM,
				maxZoom: MAX_ZOOM,
				zooms,
				tileCount,
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
