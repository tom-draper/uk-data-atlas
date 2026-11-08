import {
	POSTCODE_AREA_LAYOUT,
	POSTCODE_AREA_LAYOUT_KEY,
	postcodeAreaColumns,
	unpackText,
	readPostcodeAreaShard,
} from "@uk-data-atlas/atlas-runtime/storage";
import { type DatabaseSync, type SQLInputValue } from "node:sqlite";
import { sha256 } from "@uk-data-atlas/artifacts";
import { addAreaVersion } from "./atlasAreas.ts";
import type { IdRegistries } from "../ids/idRegistries.ts";
import { chooseDistanceFallbacks } from "./postcodeDistanceFallbacks.ts";
import {
	postcodeDistrictWhere,
	postcodeFields,
} from "@uk-data-atlas/atlas-runtime/storage";
import {
	NONE,
	SEVERAL,
	type PostcodeAreasArtifact,
	type PostcodeAreasShard,
} from "@uk-data-atlas/geography/postcode-area-types";
import type { PostcodeIndexArtifact } from "@uk-data-atlas/geography/postcode-index-types";

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

export function writePostcodeAreas(
	database: DatabaseSync,
	artifact: PostcodeAreasArtifact,
	readShard: (path: string) => string,
	registries: IdRegistries,
) {
	const columns = postcodeAreaColumns(artifact);
	const index: PostcodeIndexArtifact = JSON.parse(
		unpackText(
			database
				.prepare(
					"SELECT payload FROM payloads WHERE id = 'postcode-index'",
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
	database.exec(`DROP VIEW IF EXISTS postcodes_decoded;
		DROP VIEW IF EXISTS postcode_area_matches_decoded;
		DROP TABLE IF EXISTS postcode_area_columns;
		DROP TABLE IF EXISTS postcode_area_codes;
		DROP TABLE IF EXISTS postcode_area_matches;
		DROP TABLE IF EXISTS postcode_area_releases;
		DROP TABLE IF EXISTS postcodes_next;
		DROP TABLE IF EXISTS postcode_area_set;
		CREATE TABLE postcode_area_releases (position INTEGER PRIMARY KEY, geography TEXT NOT NULL, boundaryRelease TEXT NOT NULL, areaColumn TEXT NOT NULL UNIQUE, distanceColumn TEXT NOT NULL UNIQUE, distanceFallback INTEGER REFERENCES postcode_area_releases(position));
		CREATE TABLE postcode_area_columns (district TEXT NOT NULL, releasePosition INTEGER NOT NULL REFERENCES postcode_area_releases(position), position INTEGER NOT NULL, hasSeveral INTEGER NOT NULL, PRIMARY KEY(district, releasePosition)) WITHOUT ROWID;
		CREATE TABLE postcode_area_codes (district TEXT NOT NULL, releasePosition INTEGER NOT NULL REFERENCES postcode_area_releases(position), position INTEGER NOT NULL, areaId INTEGER NOT NULL REFERENCES area_version(id), PRIMARY KEY(district, releasePosition, position)) WITHOUT ROWID;
		CREATE TABLE postcode_area_matches (district TEXT NOT NULL, releasePosition INTEGER NOT NULL REFERENCES postcode_area_releases(position), postcodePosition INTEGER NOT NULL, position INTEGER NOT NULL, areaId INTEGER NOT NULL REFERENCES area_version(id), containment TEXT NOT NULL, distanceCm INTEGER NOT NULL, PRIMARY KEY(district, releasePosition, postcodePosition, position)) WITHOUT ROWID;
		CREATE TABLE postcode_area_set (id INTEGER PRIMARY KEY${columns.map((c) => `, ${quote(c.area)} INTEGER REFERENCES area_version(id)`).join("")}) STRICT;
		CREATE TABLE postcodes_next (postcode TEXT PRIMARY KEY, easting INTEGER, northing INTEGER, quality TEXT NOT NULL, country TEXT NOT NULL, introduced INTEGER NOT NULL, terminated INTEGER NOT NULL, largeUser TEXT NOT NULL, area_set_id INTEGER NOT NULL REFERENCES postcode_area_set(id)${columns.map((c, i) => `, ${quote(c.distance)} INTEGER${fallbacks[i] === null ? " NOT NULL" : ""}`).join("")}) WITHOUT ROWID;`);
	database.exec(
		"CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID",
	);
	database
		.prepare("INSERT OR REPLACE INTO meta VALUES (?, ?)")
		.run(POSTCODE_AREA_LAYOUT_KEY, POSTCODE_AREA_LAYOUT);
	const addRelease = database.prepare(
		"INSERT INTO postcode_area_releases VALUES (?, ?, ?, ?, ?, ?)",
	);
	const findRelease = database.prepare(
		"SELECT id FROM area_releases WHERE geography = ? AND release = ?",
	);
	const findArea = database.prepare(
		"SELECT v.id FROM area a JOIN area_version v ON v.area_id = a.id WHERE v.release_id = ? AND a.code = ?",
	);
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
	const addColumn = database.prepare(
		"INSERT INTO postcode_area_columns VALUES (?, ?, ?, ?)",
	);
	const addCode = database.prepare(
		"INSERT INTO postcode_area_codes VALUES (?, ?, ?, ?)",
	);
	const addMatch = database.prepare(
		"INSERT INTO postcode_area_matches VALUES (?, ?, ?, ?, ?, ?, ?)",
	);
	const marks = (count: number) =>
		Array.from({ length: count }, () => "?").join(",");
	const addSet = database.prepare(
		`INSERT INTO postcode_area_set VALUES (${marks(columns.length + 1)})`,
	);
	const addPostcode = database.prepare(
		`INSERT INTO postcodes_next VALUES (${marks(postcodeFields.length + 1 + columns.length)})`,
	);
	// Each distinct combination of areas is stored once, numbered in
	// first-seen postcode order. A map is cheaper than a unique index
	// over every area column, which SQLite would not enforce for nulls.
	const setIds = new Map<string, number>();
	const readPostcodes = database.prepare(
		`SELECT ${postcodeFields.join(",")} FROM postcodes WHERE ${postcodeDistrictWhere} ORDER BY postcode`,
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
		const localIds = columns.map((column, releasePosition) => {
			const value = shard.releases[column.key];
			if (
				!value ||
				value.area.length !== rows.length ||
				value.distanceCm.length !== rows.length
			)
				throw new Error(`Invalid postcode area column ${column.key}`);
			addColumn.run(
				entry.district,
				releasePosition,
				Object.keys(shard.releases).indexOf(column.key),
				Number(value.several !== undefined),
			);
			return value.codes.map((code, position) => {
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
				addCode.run(entry.district, releasePosition, position, id);
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
			addPostcode.run(...values, setId, ...distances);
		}
		if (
			readPostcodeAreaShard(
				database,
				artifact,
				entry.path,
				"postcodes_next",
			) !== text
		)
			throw new Error(
				`Invalid postcode area reconstruction ${entry.path}`,
			);
	}
	database.exec(`DROP TABLE postcodes; ALTER TABLE postcodes_next RENAME TO postcodes;
		CREATE VIEW postcodes_decoded AS SELECT ${postcodeFields.map((field) => `p.${field}`).join(", ")}${columns.map((c, i) => `, s.${quote(c.area)}, ${distanceExpression(columns, fallbacks, i)} AS ${quote(c.distance)}`).join("")}${columns.map((c, i) => `, a${i}.code AS ${quote(c.area.replace(/AreaId$/, "Code"))}`).join("")} FROM postcodes p JOIN postcode_area_set s ON s.id = p.area_set_id ${columns.map((c, i) => `LEFT JOIN areas a${i} ON a${i}.id = s.${quote(c.area)}`).join(" ")};
		CREATE VIEW postcode_area_matches_decoded AS SELECT m.*, r.geography, r.boundaryRelease, a.code, a.name FROM postcode_area_matches m JOIN postcode_area_releases r ON r.position = m.releasePosition JOIN areas a ON a.id = m.areaId;`);
}
