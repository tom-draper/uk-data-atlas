import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sourceDir } from "@uk-data-atlas/datasets";
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

/** Published ONS centroids for the matching 2021 England and Wales release. */
export function readPublishedCentroids(root: string) {
	const path = join(
		root,
		"data/source",
		sourceDir(
			"population-weighted-centroids",
			"oa-2021-ew-v4/oa-2021-ew-pwc.csv",
		),
	);
	const [header, ...lines] = readFileSync(path, "utf8").trim().split("\n");
	if (header !== "OA21CD,longitude,latitude")
		throw new Error(`Unexpected centroid columns in ${path}`);
	const points = new Map<string, readonly [number, number]>();
	for (const line of lines) {
		const [code, longitude, latitude] = line.split(",");
		const point = [Number(longitude), Number(latitude)] as const;
		if (
			!code ||
			!longitude ||
			!latitude ||
			!Number.isFinite(point[0]) ||
			!Number.isFinite(point[1]) ||
			points.has(code)
		)
			throw new Error(`Invalid centroid in ${path}: ${line}`);
		points.set(code, point);
	}
	return points;
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
	centroids = readPublishedCentroids(root),
) {
	database.exec(`CREATE TABLE area_location (
		area_version_id INTEGER PRIMARY KEY REFERENCES area_version(id),
		longitude REAL, latitude REAL, min_longitude REAL, min_latitude REAL, max_longitude REAL, max_latitude REAL,
		method TEXT CHECK (method IN ('polygon-interior-point', 'ons-population-weighted-2021')),
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
		else {
			const published =
				row.geography === "outputArea" &&
				row.release === "2021-12-ew-bgc-v2"
					? centroids.get(String(row.code))
					: undefined;
			const usable =
				published &&
				published[0] >= location.minLongitude &&
				published[0] <= location.maxLongitude &&
				published[1] >= location.minLatitude &&
				published[1] <= location.maxLatitude;
			insert.run(
				row.id as number,
				usable ? published[0] : location.longitude,
				usable ? published[1] : location.latitude,
				location.minLongitude,
				location.minLatitude,
				location.maxLongitude,
				location.maxLatitude,
				usable
					? "ons-population-weighted-2021"
					: "polygon-interior-point",
				null,
			);
		}
	}
}
