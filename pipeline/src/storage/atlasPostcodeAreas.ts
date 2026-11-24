import { unpackText } from "@uk-data-atlas/atlas-db";
import { type DatabaseSync, type SQLInputValue } from "node:sqlite";
import { sha256 } from "@uk-data-atlas/artifacts";
import { addAreaVersion } from "./atlasAreas.ts";
import type { IdRegistries } from "../ids/idRegistries.ts";
import { chooseDistanceFallbacks } from "./postcodeDistanceFallbacks.ts";
import {
	POSTCODE_AREA_LAYOUT,
	POSTCODE_AREA_LAYOUT_KEY,
	postcodeAreaColumns,
	readPostcodeAreaShard,
	postcodeDistrictWhere,
	postcodeFields,
} from "@uk-data-atlas/places/postcodes";
import {
	NONE,
	parseLookupCoordinate,
	SEVERAL,
	type PostcodeAreasArtifact,
	type PostcodeAreasShard,
} from "@uk-data-atlas/geography";
import type { PostcodeIndexArtifact } from "@uk-data-atlas/geography";

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

/** A release's distance: its own column, else the first earlier one set. */
function distanceExpression(
	columns: Array<{ distance: string }>,
	fallbacks: Array<number | null>,
	position: number,
) {
	const names: string[] = [];
	for (
		let at: number | null = position;
		at !== null;
		at = fallbacks[at] ?? null
	)
		names.push(`p.${quote(columns[at]!.distance)}`);
	return names.length > 1 ? `COALESCE(${names.join(", ")})` : names[0]!;
}

/**
 * A release's version of an area, by code. The file has no planner statistics
 * yet, so a plain join starts from the release's versions and tests every one
 * of them against the code. CROSS JOIN fixes the order: the code index
 * first, then the one version.
 */
export const FIND_RELEASE_AREA_VERSION =
	"SELECT v.id FROM area a CROSS JOIN area_version v ON v.area_id = a.id WHERE v.release_id = ? AND a.code = ?";

export function writePostcodeAreas(
	database: DatabaseSync,
	build: DatabaseSync,
	artifact: PostcodeAreasArtifact,
	readShard: (path: string) => string,
	registries: IdRegistries,
) {
	const columns = postcodeAreaColumns(artifact);
	const index: PostcodeIndexArtifact = JSON.parse(
		unpackText(
			build
				.prepare(
					"SELECT payload FROM payload WHERE id = 'postcode-index'",
				)
				.get()!.payload,
		)!,
	);
	if (
		artifact.shards.length !== index.shards.length ||
		new Set(artifact.shards.map((entry) => entry.district)).size !==
			index.shards.length
	)
		throw new Error(
			"Postcode area shard inventory does not match postcodes",
		);
	if (index.contentHash !== artifact.postcodeIndex)
		throw new Error("Postcode area index does not match postcodes");
	const fallbacks = chooseDistanceFallbacks(
		columns.map((column) => column.key),
		artifact,
		readShard,
	);
	database.exec(`DROP VIEW IF EXISTS postcode_decoded;
		DROP VIEW IF EXISTS postcode_area_match_decoded;
		DROP TABLE IF EXISTS postcode_area_columns;
		DROP TABLE IF EXISTS postcode_area_codes;
		DROP TABLE IF EXISTS postcode_area_match;
		DROP TABLE IF EXISTS postcode_area_release;
		DROP TABLE IF EXISTS postcode_next;
		DROP TABLE IF EXISTS postcode_area_set;
		CREATE TABLE postcode_area_release (position INTEGER PRIMARY KEY, geography TEXT NOT NULL, boundary_release TEXT NOT NULL, area_column TEXT NOT NULL UNIQUE, distance_column TEXT NOT NULL UNIQUE, distance_fallback INTEGER REFERENCES postcode_area_release(position)) STRICT;
		CREATE TABLE postcode_area_match (district TEXT NOT NULL, release_position INTEGER NOT NULL REFERENCES postcode_area_release(position), postcode_position INTEGER NOT NULL, position INTEGER NOT NULL, area_id INTEGER NOT NULL REFERENCES area_version(id), containment TEXT NOT NULL, distance_cm INTEGER NOT NULL, PRIMARY KEY(district, release_position, postcode_position, position)) STRICT, WITHOUT ROWID;
		CREATE TABLE postcode_area_set (id INTEGER PRIMARY KEY${columns.map((c) => `, ${quote(c.area)} INTEGER REFERENCES area_version(id)`).join("")}) STRICT;
		CREATE TABLE postcode_next (postcode TEXT PRIMARY KEY, easting INTEGER, northing INTEGER, latitude_microdegrees INTEGER, longitude_microdegrees INTEGER, quality TEXT NOT NULL, country TEXT NOT NULL, introduced INTEGER NOT NULL, terminated INTEGER NOT NULL, large_user TEXT NOT NULL, area_set_id INTEGER NOT NULL REFERENCES postcode_area_set(id)${columns.map((c, i) => `, ${quote(c.distance)} INTEGER${fallbacks[i] === null ? " NOT NULL" : ""}`).join("")}) STRICT, WITHOUT ROWID;`);
	database.exec(
		"CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT, WITHOUT ROWID",
	);
	database
		.prepare("INSERT OR REPLACE INTO meta VALUES (?, ?)")
		.run(POSTCODE_AREA_LAYOUT_KEY, POSTCODE_AREA_LAYOUT);
	const addRelease = database.prepare(
		"INSERT INTO postcode_area_release VALUES (?, ?, ?, ?, ?, ?)",
	);
	const findRelease = database.prepare(
		"SELECT id FROM area_release WHERE geography = ? AND release = ?",
	);
	const findArea = database.prepare(FIND_RELEASE_AREA_VERSION);
	const addArea = addAreaVersion(database, registries);
	const ids = columns.map((column, position) => {
		addRelease.run(
			position,
			column.geography,
			column.boundaryRelease,
			column.area,
			column.distance,
			fallbacks[position]!,
		);
		const release = findRelease.get(
			column.geography,
			column.boundaryRelease,
		);
		if (!release)
			throw new Error(`Missing postcode area release ${column.key}`);
		return {
			release: Number(release.id),
			codes: new Map<string, number>(),
		};
	});
	build.exec(`DROP TABLE IF EXISTS postcode_area_shard_hash;
		CREATE TABLE postcode_area_shard_hash (district TEXT PRIMARY KEY, sha256 TEXT NOT NULL, coordinates_sha256 TEXT NOT NULL) STRICT, WITHOUT ROWID`);
	const addShardHash = build.prepare(
		"INSERT INTO postcode_area_shard_hash VALUES (?, ?, ?)",
	);
	const addMatch = database.prepare(
		"INSERT INTO postcode_area_match VALUES (?, ?, ?, ?, ?, ?, ?)",
	);
	const marks = (count: number) =>
		Array.from({ length: count }, () => "?").join(",");
	const addSet = database.prepare(
		`INSERT INTO postcode_area_set VALUES (${marks(columns.length + 1)})`,
	);
	const addPostcode = database.prepare(
		`INSERT INTO postcode_next VALUES (${marks(postcodeFields.length + 3 + columns.length)})`,
	);
	// Each distinct combination of areas is stored once, numbered in
	// first-seen postcode order. A map is cheaper than a unique index
	// over every area column, which SQLite would not enforce for nulls.
	const setIds = new Map<string, number>();
	const readPostcodes = database.prepare(
		`SELECT ${postcodeFields.join(",")} FROM postcode WHERE ${postcodeDistrictWhere} ORDER BY postcode`,
	);
	for (const entry of artifact.shards) {
		const text = readShard(entry.path);
		if (sha256(text) !== entry.contentHash)
			throw new Error(`Invalid postcode area shard ${entry.path}`);
		const shard: PostcodeAreasShard = JSON.parse(text);
		const postcodeEntry = index.shards.find(
			(e) => e.district === entry.district,
		);
		if (
			shard.schemaVersion !== 1 ||
			shard.district !== entry.district ||
			shard.postcodeShard !== postcodeEntry?.contentHash
		)
			throw new Error(`Invalid postcode area district ${entry.district}`);
		const rows = readPostcodes.all(
			entry.district,
			`${entry.district}\x7f`,
			entry.district.length + 3,
		);
		if (
			rows.length !== postcodeEntry.postcodes ||
			Object.keys(shard.releases).length !== columns.length
		)
			throw new Error(`Invalid postcode area columns ${entry.path}`);
		const coordinateValues: Array<number | null> = [];
		const localIds = columns.map((column, releasePosition) => {
			const value = shard.releases[column.key];
			if (
				!value ||
				value.area.length !== rows.length ||
				value.distanceCm.length !== rows.length
			)
				throw new Error(`Invalid postcode area column ${column.key}`);
			return value.codes.map((code) => {
				const cache = ids[releasePosition]!;
				let id = cache.codes.get(code);
				if (id === undefined) {
					let area = findArea.get(cache.release, code);
					if (!area) {
						addArea(cache.release, code, "", null);
						area = findArea.get(cache.release, code)!;
					}
					id = Number(area.id);
					cache.codes.set(code, id);
				}
				return id;
			});
		});
		for (const [position, row] of rows.entries()) {
			const values: SQLInputValue[] = postcodeFields.map(
				(field) => row[field]!,
			);
			const areas: Array<number | null> = [];
			const distances: Array<number | null> = [];
			for (const [releasePosition, column] of columns.entries()) {
				const value = shard.releases[column.key]!;
				const area = value.area[position]!;
				if (
					area !== NONE &&
					area !== SEVERAL &&
					localIds[releasePosition]![area] === undefined
				)
					throw new Error(
						`Invalid postcode area reference ${entry.path}`,
					);
				areas.push(
					area >= 0 ? localIds[releasePosition]![area]! : null,
				);
				const distance = value.distanceCm[position]!;
				const fallback = fallbacks[releasePosition]!;
				// Null where an earlier release holds the same distance.
				distances.push(
					fallback !== null &&
						distance !== 0 &&
						distance ===
							shard.releases[columns[fallback]!.key]!.distanceCm[
								position
							]
						? null
						: distance,
				);
				if (area === SEVERAL) {
					const matches = value.several?.[position];
					if (!matches?.length)
						throw new Error(
							`Missing postcode area matches ${entry.path}`,
						);
					for (const [
						at,
						[code, containment, distance],
					] of matches.entries())
						addMatch.run(
							entry.district,
							releasePosition,
							position,
							at,
							localIds[releasePosition]![code]!,
							containment,
							distance,
						);
				}
			}
			const key = areas.join(",");
			let setId = setIds.get(key);
			if (setId === undefined) {
				setId = setIds.size + 1;
				setIds.set(key, setId);
				addSet.run(setId, ...areas);
			}
			const point =
				row.easting !== null && row.northing !== null
					? parseLookupCoordinate("EPSG:27700", {
							easting: String(row.easting),
							northing: String(row.northing),
						})
					: null;
			if (point === undefined)
				throw new Error(
					`Invalid postcode grid reference in ${entry.path}`,
				);
			const latitude = point ? Math.round(point.lat * 1e6) : null;
			const longitude = point ? Math.round(point.lng * 1e6) : null;
			coordinateValues.push(latitude, longitude);
			addPostcode.run(
				...values.slice(0, 3),
				latitude,
				longitude,
				...values.slice(3),
				setId,
				...distances,
			);
		}
		const derived = readPostcodeAreaShard(
			database,
			build,
			artifact,
			entry.path,
			"postcode_next",
			false,
		);
		addShardHash.run(
			entry.district,
			sha256(derived),
			sha256(JSON.stringify(coordinateValues)),
		);
	}
	database.exec(`DROP TABLE postcode; ALTER TABLE postcode_next RENAME TO postcode;
		CREATE VIEW postcode_decoded AS SELECT ${postcodeFields.map((field) => `p.${field}`).join(", ")}, p.latitude_microdegrees / 1000000.0 AS latitude, p.longitude_microdegrees / 1000000.0 AS longitude${columns.map((c, i) => `, s.${quote(c.area)}, ${distanceExpression(columns, fallbacks, i)} AS ${quote(c.distance)}`).join("")}${columns.map((c, i) => `, a${i}.code AS ${quote(c.area.replace(/_area_id$/, "_code"))}`).join("")} FROM postcode p JOIN postcode_area_set s ON s.id = p.area_set_id ${columns.map((c, i) => `LEFT JOIN area_version v${i} ON v${i}.id = s.${quote(c.area)} LEFT JOIN area a${i} ON a${i}.id = v${i}.area_id`).join(" ")};
		CREATE VIEW postcode_area_match_decoded AS SELECT m.*, r.geography, r.boundary_release, a.code, v.name FROM postcode_area_match m JOIN postcode_area_release r ON r.position = m.release_position JOIN area_version v ON v.id = m.area_id JOIN area a ON a.id = v.area_id;`);
}
