import { gzipSync } from "node:zlib";
import type { AreaGeometryCache } from "@uk-data-atlas/atlas-runtime/geometry";
import { buildGeoJson } from "@uk-data-atlas/atlas-runtime/maps";
import { buildGeoParquet } from "@uk-data-atlas/atlas-runtime/maps";
import {
	compileTileset,
	LAYER_NAME,
} from "@uk-data-atlas/map-tiles/compileTileset";
import { MAX_ZOOM, MIN_ZOOM } from "@uk-data-atlas/map-tiles/tileset";
import { TOPOLOGY_METHOD } from "@uk-data-atlas/map-tiles/topologyTiers";
import { releaseKey } from "@uk-data-atlas/geography";
import { sha256 } from "@uk-data-atlas/artifacts";
import {
	buildFullDetailParquet,
	GEOJSON_TIERS,
} from "@uk-data-atlas/atlas-runtime/maps";

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

export { LAYER_NAME };

import type { MapResourceDescriptor } from "@uk-data-atlas/map-tiles/mapResources";

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
						href: `/v1/map-resources/${id}/features?tier=${tier}`,
						bytes: parquet.length,
						contentHash: sha256(parquet),
					},
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
					href: `/v1/map-resources/${id}/features?tier=${tier}&format=geojson`,
					bytes: geoJson.bytes,
					contentHash: geoJson.contentHash,
					gzipBytes: geoJson.gzipped.length,
				},
			});
			return downloads;
		},
	);
	return {
		archive,
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
