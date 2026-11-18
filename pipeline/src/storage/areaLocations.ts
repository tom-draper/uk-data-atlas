import type { DatabaseSync } from "node:sqlite";
import GeometryFactory from "jsts/org/locationtech/jts/geom/GeometryFactory.js";
import GeoJSONReader from "jsts/org/locationtech/jts/io/GeoJSONReader.js";
import InteriorPointArea from "jsts/org/locationtech/jts/algorithm/InteriorPointArea.js";
import {
	containPoint,
	geometryBounds,
	type GeoJsonGeometry,
} from "@uk-data-atlas/geography";
import {
	createAreaGeometryCache,
	readGeometrySources,
} from "@uk-data-atlas/geometry";

const reader = new GeoJSONReader(new GeometryFactory());

/** A scanline interior point, not a population-weighted centroid. */
export function areaLocation(geometry: GeoJsonGeometry) {
	const bounds = geometryBounds(geometry);
	if (!bounds) return undefined;
	try {
		const point = InteriorPointArea.getInteriorPoint(reader.read(geometry));
		if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y))
			return undefined;
		if (containPoint([point.x, point.y], geometry) !== "interior")
			return undefined;
		// Outward rounding retains every coordinate in the source envelope.
		const scale = 1_000_000;
		return {
			longitude: point.x as number,
			latitude: point.y as number,
			minLongitude: Math.floor(bounds[0] * scale) / scale,
			minLatitude: Math.floor(bounds[1] * scale) / scale,
			maxLongitude: Math.ceil(bounds[2] * scale) / scale,
			maxLatitude: Math.ceil(bounds[3] * scale) / scale,
		};
	} catch {
		return undefined;
	}
}

/** Writes one row for every area version, including an explicit reason for gaps. */
export function writeAreaLocations(
	database: DatabaseSync,
	root: string,
	cache: Pick<
		ReturnType<typeof createAreaGeometryCache>,
		"get"
	> = createAreaGeometryCache(root, 1),
	sources = readGeometrySources(root),
) {
	database.exec(`CREATE TABLE area_location (
		area_version_id INTEGER PRIMARY KEY REFERENCES area_version(id),
		longitude REAL, latitude REAL, min_longitude REAL, min_latitude REAL, max_longitude REAL, max_latitude REAL,
		method TEXT CHECK (method = 'polygon-interior-point'),
		gap TEXT CHECK (gap IN ('no-geometry', 'no-interior-point')),
		CHECK ((gap IS NULL AND method IS NOT NULL AND longitude IS NOT NULL AND latitude IS NOT NULL AND min_longitude IS NOT NULL AND min_latitude IS NOT NULL AND max_longitude IS NOT NULL AND max_latitude IS NOT NULL AND longitude BETWEEN min_longitude AND max_longitude AND latitude BETWEEN min_latitude AND max_latitude) OR
		(gap IS NOT NULL AND method IS NULL AND longitude IS NULL AND latitude IS NULL AND min_longitude IS NULL AND min_latitude IS NULL AND max_longitude IS NULL AND max_latitude IS NULL))
	) STRICT`);
	const insert = database.prepare(
		"INSERT INTO area_location VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
	);
	const versions = database.prepare(
		`SELECT v.id, a.code, r.geography, r.release FROM area_version v JOIN area a ON a.id = v.area_id JOIN area_releases r ON r.id = v.release_id ORDER BY r.geography, r.release, a.code`,
	);
	for (const row of versions.iterate()) {
		const geometry = sources.has(
			`${String(row.geography)}/${String(row.release)}`,
		)
			? cache.get(
					String(row.geography),
					String(row.release),
					String(row.code),
				)
			: undefined;
		const location = geometry && areaLocation(geometry);
		if (!location)
			insert.run(
				row.id as number,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				geometry ? "no-interior-point" : "no-geometry",
			);
		else
			insert.run(
				row.id as number,
				location.longitude,
				location.latitude,
				location.minLongitude,
				location.minLatitude,
				location.maxLongitude,
				location.maxLatitude,
				"polygon-interior-point",
				null,
			);
	}
}
