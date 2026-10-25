import { type DatabaseSync, type SQLInputValue } from "node:sqlite";
import { sha256 } from "./contentHash";
import { postcodeDistrictWhere, postcodeFields } from "./atlasPostcodes";
import {
	NONE,
	SEVERAL,
	releaseKey,
	type PostcodeAreasArtifact,
	type PostcodeAreasShard,
	type PostcodeAreaColumn,
} from "./postcodeAreas";
import type { PostcodeIndexArtifact } from "./postcodes";

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

export const postcodeAreaColumns = (artifact: PostcodeAreasArtifact) =>
	artifact.releases.map((release) => {
		const repeated =
			artifact.releases.filter(
				(other) => other.geography === release.geography,
			).length > 1;
		const stem = repeated
			? `${release.geography}_${release.boundaryRelease}`
			: release.geography;
		return {
			...release,
			key: releaseKey(release.geography, release.boundaryRelease),
			area: `${stem}AreaId`,
			distance: `${stem}DistanceCm`,
		};
	});

export function writePostcodeAreas(
	database: DatabaseSync,
	artifact: PostcodeAreasArtifact,
	readShard: (path: string) => string,
) {
	const columns = postcodeAreaColumns(artifact);
	const index: PostcodeIndexArtifact = JSON.parse(
		String(
			database
				.prepare(
					"SELECT payload FROM payloads WHERE id = 'postcode-index'",
				)
				.get()!.payload,
		),
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
	database.exec(`DROP VIEW IF EXISTS postcodes_decoded;
		DROP VIEW IF EXISTS postcode_area_matches_decoded;
		DROP TABLE IF EXISTS postcode_area_columns;
		DROP TABLE IF EXISTS postcode_area_codes;
		DROP TABLE IF EXISTS postcode_area_matches;
		DROP TABLE IF EXISTS postcode_area_releases;
		CREATE TABLE postcode_area_releases (position INTEGER PRIMARY KEY, geography TEXT NOT NULL, boundaryRelease TEXT NOT NULL, areaColumn TEXT NOT NULL UNIQUE, distanceColumn TEXT NOT NULL UNIQUE);
		CREATE TABLE postcode_area_columns (district TEXT NOT NULL, releasePosition INTEGER NOT NULL REFERENCES postcode_area_releases(position), position INTEGER NOT NULL, hasSeveral INTEGER NOT NULL, PRIMARY KEY(district, releasePosition)) WITHOUT ROWID;
		CREATE TABLE postcode_area_codes (district TEXT NOT NULL, releasePosition INTEGER NOT NULL REFERENCES postcode_area_releases(position), position INTEGER NOT NULL, areaId INTEGER NOT NULL REFERENCES areas(id), PRIMARY KEY(district, releasePosition, position)) WITHOUT ROWID;
		CREATE TABLE postcode_area_matches (district TEXT NOT NULL, releasePosition INTEGER NOT NULL REFERENCES postcode_area_releases(position), postcodePosition INTEGER NOT NULL, position INTEGER NOT NULL, areaId INTEGER NOT NULL REFERENCES areas(id), containment TEXT NOT NULL, distanceCm INTEGER NOT NULL, PRIMARY KEY(district, releasePosition, postcodePosition, position)) WITHOUT ROWID;
		CREATE TABLE postcodes_next (postcode TEXT PRIMARY KEY, easting INTEGER, northing INTEGER, quality TEXT NOT NULL, country TEXT NOT NULL, introduced INTEGER NOT NULL, terminated INTEGER NOT NULL, largeUser TEXT NOT NULL${columns.map((c) => `, ${quote(c.area)} INTEGER REFERENCES areas(id), ${quote(c.distance)} INTEGER NOT NULL`).join("")}) WITHOUT ROWID;`);
	const addRelease = database.prepare(
		"INSERT INTO postcode_area_releases VALUES (?, ?, ?, ?, ?)",
	);
	const findRelease = database.prepare(
		"SELECT position FROM area_releases WHERE geography = ? AND id = ?",
	);
	const findArea = database.prepare(
		"SELECT id FROM areas WHERE releasePosition = ? AND code = ?",
	);
	const addArea = database.prepare(
		"INSERT INTO areas (releasePosition, code, inInventory, name, aliases) VALUES (?, ?, 0, '', NULL)",
	);
	const ids = columns.map((column, position) => {
		addRelease.run(
			position,
			column.geography,
			column.boundaryRelease,
			column.area,
			column.distance,
		);
		const release = findRelease.get(
			column.geography,
			column.boundaryRelease,
		);
		if (!release)
			throw new Error(`Missing postcode area release ${column.key}`);
		return {
			release: Number(release.position),
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
	const addPostcode = database.prepare(
		`INSERT INTO postcodes_next VALUES (${Array.from({ length: postcodeFields.length + columns.length * 2 }, () => "?").join(",")})`,
	);
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
						addArea.run(cache.release, code);
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
				values.push(
					area >= 0 ? localIds[releasePosition]![area]! : null,
					value.distanceCm[position]!,
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
			addPostcode.run(...values);
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
		CREATE VIEW postcodes_decoded AS SELECT p.*${columns.map((c, i) => `, a${i}.code AS ${quote(c.area.replace(/AreaId$/, "Code"))}`).join("")} FROM postcodes p ${columns.map((c, i) => `LEFT JOIN areas a${i} ON a${i}.id = p.${quote(c.area)}`).join(" ")};
		CREATE VIEW postcode_area_matches_decoded AS SELECT m.*, r.geography, r.boundaryRelease, a.code, a.name FROM postcode_area_matches m JOIN postcode_area_releases r ON r.position = m.releasePosition JOIN areas a ON a.id = m.areaId;`);
}

export function readPostcodeAreaShard(
	database: DatabaseSync,
	artifact: PostcodeAreasArtifact,
	path: string,
	table = "postcodes",
): string {
	const entry = artifact.shards.find((e) => e.path === path);
	if (!entry) throw new Error(`Missing postcode area shard ${path}`);
	const index: PostcodeIndexArtifact = JSON.parse(
		String(
			database
				.prepare(
					"SELECT payload FROM payloads WHERE id = 'postcode-index'",
				)
				.get()!.payload,
		),
	);
	const rows = database
		.prepare(
			`SELECT * FROM ${table} WHERE ${postcodeDistrictWhere} ORDER BY postcode`,
		)
		.all(
			entry.district,
			`${entry.district}\x7f`,
			entry.district.length + 3,
		);
	const columns = postcodeAreaColumns(artifact);
	const headers = database
		.prepare(
			"SELECT * FROM postcode_area_columns WHERE district = ? ORDER BY position",
		)
		.all(entry.district);
	const releases: PostcodeAreasShard["releases"] = {};
	for (const header of headers) {
		const position = Number(header.releasePosition);
		const column = columns[position]!;
		const codes = database
			.prepare(
				"SELECT c.areaId, a.code FROM postcode_area_codes c JOIN areas a ON a.id = c.areaId WHERE c.district = ? AND c.releasePosition = ? ORDER BY c.position",
			)
			.all(entry.district, position);
		const codePositions = new Map(
			codes.map((c, at) => [Number(c.areaId), at]),
		);
		const several: NonNullable<PostcodeAreaColumn["several"]> = {};
		for (const match of database
			.prepare(
				"SELECT * FROM postcode_area_matches WHERE district = ? AND releasePosition = ? ORDER BY postcodePosition, position",
			)
			.all(entry.district, position)) {
			const at = String(match.postcodePosition);
			(several[at] ??= []).push([
				codePositions.get(Number(match.areaId))!,
				match.containment as "boundary" | "interior",
				Number(match.distanceCm),
			]);
		}
		releases[column.key] = {
			codes: codes.map((c) => String(c.code)),
			area: rows.map((row, at) =>
				row[column.area] === null
					? several[at]
						? SEVERAL
						: NONE
					: codePositions.get(Number(row[column.area]))!,
			),
			distanceCm: rows.map((row) => Number(row[column.distance])),
			...(header.hasSeveral ? { several } : {}),
		};
	}
	const shard: PostcodeAreasShard = {
		schemaVersion: 1,
		district: entry.district,
		postcodeShard: index.shards.find((e) => e.district === entry.district)!
			.contentHash,
		releases,
	};
	const text = `${JSON.stringify(shard)}\n`;
	if (sha256(text) !== entry.contentHash)
		throw new Error(`Invalid SQLite postcode area shard ${path}`);
	return text;
}
