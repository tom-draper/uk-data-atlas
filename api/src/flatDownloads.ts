import { createHash } from "node:crypto";
import type { AreaGeometryCache, GeoJsonGeometry } from "./areaGeometry";
import { releaseKey } from "./geographyKeys";
import {
	featureIds,
	type BoundaryReleaseSummary,
	type MapResourceDescriptor,
} from "./mapResource/compileMapResource";
import { buildGeoJson } from "./mapResource/geoJson";
import { buildGeoParquet } from "./mapResource/geoParquet";
import type { GeometryTier } from "./simplifyGeometry";

const sha256 = (content: Buffer) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

/** A release's flat downloads when no tiles can be drawn from it. */
export type FlatDownloads = {
	/** Why the release has downloads but no tiles. */
	reason: string;
	features: MapResourceDescriptor["features"];
};

/**
 * An area's polygons as one polygon or multipolygon. A code published as
 * several features arrives as a collection of them, which a download writes
 * as the one multipolygon it is.
 */
const polygonal = (geometry: GeoJsonGeometry): GeoJsonGeometry | undefined => {
	if (geometry.type === "Polygon" || geometry.type === "MultiPolygon")
		return geometry;
	if (geometry.type !== "GeometryCollection") return undefined;
	const polygons = (geometry.geometries ?? []).flatMap((part) => {
		const shape = polygonal(part);
		return !shape
			? []
			: shape.type === "Polygon"
				? [shape.coordinates]
				: (shape.coordinates as unknown[]);
	});
	return polygons.length > 0
		? { type: "MultiPolygon", coordinates: polygons }
		: undefined;
};

/**
 * The whole-release downloads of a release that cannot be tiled, because its
 * areas are not a coverage: some edge lies on more than two of them, so
 * borders cannot be shared and generalised once. A download needs no shared
 * borders, so the release is still offered whole, at full detail only, as
 * published: generalising each area on its own would open gaps between them.
 */
export const compileFlatDownloads = (
	cache: AreaGeometryCache,
	release: BoundaryReleaseSummary,
	names: Map<string, string>,
	artifactBase: string,
	reason: string,
):
	| {
			downloads: FlatDownloads;
			files: Array<{ artifact: string; body: Buffer }>;
	  }
	| undefined => {
	const { geography, id: boundaryRelease } = release;
	const codes = cache
		.codes(geography, boundaryRelease)
		.filter((code) => names.size === 0 || names.has(code));
	const numbered = featureIds(codes);
	const rows = codes.flatMap((code) => {
		const geometry = cache.get(geography, boundaryRelease, code);
		const shape = geometry && polygonal(geometry);
		return shape
			? [
					{
						id: numbered.get(code)!,
						code,
						name: names.get(code) ?? code,
						geometry: shape,
					},
				]
			: [];
	});
	if (rows.length === 0) return undefined;
	const id = releaseKey(geography, boundaryRelease);
	const attribution = `Contains ${release.source.publisher} data, ${release.source.licence.name}`;
	const coordinates = rows.reduce(
		(sum, row) => sum + positionCount(row.geometry.coordinates),
		0,
	);
	const parquet = buildGeoParquet(rows, {
		mapResource: id,
		tier: "full",
		toleranceM: 0,
		topology: "none",
		attribution,
		geometrySourceInputHash:
			cache.provenance(geography, boundaryRelease).inputHash ?? null,
	});
	const geoJson = buildGeoJson(rows, {
		mapResource: id,
		tier: "full",
		attribution,
	});
	const base = {
		tier: "full" as GeometryTier,
		toleranceM: 0,
		rowCount: rows.length,
		coordinates,
	};
	const parquetArtifact = `${artifactBase}-full.parquet`;
	const geoJsonArtifact = `${artifactBase}-full.geojson.gz`;
	return {
		downloads: {
			reason,
			features: [
				{
					...base,
					format: "geoparquet-1.1",
					artifact: parquetArtifact,
					href: `/v1/map-resources/${id}/features?tier=full`,
					bytes: parquet.length,
					contentHash: sha256(parquet),
				},
				{
					...base,
					format: "geojson",
					artifact: geoJsonArtifact,
					href: `/v1/map-resources/${id}/features?tier=full&format=geojson`,
					bytes: geoJson.bytes,
					contentHash: geoJson.contentHash,
					gzipBytes: geoJson.gzipped.length,
				},
			],
		},
		files: [
			{ artifact: parquetArtifact, body: parquet },
			{ artifact: geoJsonArtifact, body: geoJson.gzipped },
		],
	};
};

/** Positions in a GeoJSON coordinates array, however deeply nested. */
const positionCount = (coordinates: unknown): number =>
	Array.isArray(coordinates)
		? typeof coordinates[0] === "number"
			? 1
			: coordinates.reduce(
					(sum: number, child) => sum + positionCount(child),
					0,
				)
		: 0;
