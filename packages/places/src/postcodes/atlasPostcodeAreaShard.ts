import type { SqlReader } from "@uk-data-atlas/atlas-db";
import { unpackText } from "@uk-data-atlas/atlas-db";
import { sha256 } from "@uk-data-atlas/artifacts";
import { postcodeDistrictWhere } from "./atlasPostcodeShard.ts";
import {
	NONE,
	SEVERAL,
	releaseKey,
	type PostcodeAreasArtifact,
	type PostcodeAreasShard,
	type PostcodeAreaColumn,
} from "@uk-data-atlas/geography";
import type { PostcodeIndexArtifact } from "@uk-data-atlas/geography";

/** The `meta` key and value that mark the postcode area table layout. */
export const POSTCODE_AREA_LAYOUT_KEY = "postcodeAreaLayout";
export const POSTCODE_AREA_LAYOUT = "9";

/** Refuse a database built before stored postcode coordinates were added. */
export function requirePostcodeAreaLayout(database: SqlReader) {
	let found: unknown;
	try {
		found = database
			.prepare("SELECT value FROM meta WHERE key = ?")
			.get(POSTCODE_AREA_LAYOUT_KEY)?.value;
	} catch {
		// A database without a meta table predates the marker.
	}
	if (found !== POSTCODE_AREA_LAYOUT)
		throw new Error(
			`atlas.sqlite has postcode area layout ${String(found ?? "1")} but this code needs ${POSTCODE_AREA_LAYOUT}. Rebuild it with pnpm data:build.`,
		);
}

/** A release stem as a snake_case column prefix: `dataZone` and `ward_2025-05` become `data_zone` and `ward_2025_05`. */
export const columnStem = (stem: string) =>
	stem
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/[^A-Za-z0-9]+/g, "_")
		.toLowerCase();

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
			area: `${columnStem(stem)}_area_id`,
			distance: `${columnStem(stem)}_distance_cm`,
		};
	});

/**
 * The release position each distance column falls back to when null, or null
 * for a column that always holds its own value. Fallbacks point at earlier
 * positions, so one pass in order resolves every chain.
 */
export function distanceFallbacks(database: SqlReader) {
	return new Map(
		database
			.prepare(
				"SELECT position, distance_fallback FROM postcode_area_release",
			)
			.all()
			.map((row) => [
				Number(row.position),
				row.distance_fallback === null
					? null
					: Number(row.distance_fallback),
			]),
	);
}

export function readPostcodeAreaShard(
	database: SqlReader,
	build: SqlReader,
	artifact: PostcodeAreasArtifact,
	path: string,
	table = "postcode",
	verify = true,
): string {
	const entry = artifact.shards.find((e) => e.path === path);
	if (!entry) throw new Error(`Missing postcode area shard ${path}`);
	const index: PostcodeIndexArtifact = JSON.parse(
		unpackText(
			build
				.prepare(
					"SELECT payload FROM payload WHERE id = 'postcode-index'",
				)
				.get()!.payload,
		)!,
	);
	const postcodeShard = index.shards.find(
		(e) => e.district === entry.district,
	)!.contentHash;
	const readDistrict = preparePostcodeAreaDistrictReader(
		database,
		artifact,
		table,
	);
	const text = readDistrict(entry.district, postcodeShard);
	if (verify) {
		const expected = build
			.prepare(
				"SELECT sha256 FROM postcode_area_shard_hash WHERE district = ?",
			)
			.get(entry.district)?.sha256;
		if (expected !== sha256(text))
			throw new Error(`Invalid SQLite postcode area shard ${path}`);
	}
	return text;
}

/** Reconstruct districts against one postcode area layout. The caller supplies
 * each district's index hash from the postcode index manifest. */
export function preparePostcodeAreaDistrictReader(
	database: SqlReader,
	artifact: PostcodeAreasArtifact,
	table: string,
) {
	const columns = postcodeAreaColumns(artifact);
	const fallbacks = distanceFallbacks(database);
	const readRows = database.prepare(
		`SELECT p.*, s.* FROM ${table} p JOIN postcode_area_set s ON s.id = p.area_set_id WHERE ${postcodeDistrictWhere} ORDER BY p.postcode`,
	);
	const findCode = database.prepare(
		"SELECT a.code FROM area_version v JOIN area a ON a.id = v.area_id WHERE v.id = ?",
	);
	const readMatches = database.prepare(
		"SELECT * FROM postcode_area_match WHERE district = ? AND release_position = ? ORDER BY postcode_position, position",
	);
	return (district: string, postcodeShard: string): string => {
		const rows = readRows.all(
			district,
			`${district}\x7f`,
			district.length + 3,
		);
		const resolved = new Map<number, number[]>();
		const distancesOf = (position: number): number[] => {
			let distances = resolved.get(position);
			if (distances) return distances;
			const column = columns[position]!;
			const fallback = fallbacks.get(position) ?? null;
			const base = fallback === null ? undefined : distancesOf(fallback);
			distances = rows.map((row, at) => {
				const value = row[column.distance];
				if (value !== null) return Number(value);
				if (!base)
					throw new Error(`Missing postcode distance ${column.key}`);
				return base[at]!;
			});
			resolved.set(position, distances);
			return distances;
		};
		const releases: PostcodeAreasShard["releases"] = {};
		for (const [position, column] of columns.entries()) {
			const matches = readMatches.all(district, position);
			const ids = new Set<number>();
			for (const row of rows)
				if (row[column.area] !== null)
					ids.add(Number(row[column.area]));
			for (const match of matches) ids.add(Number(match.area_id));
			const areaCodes = new Map<number, string>();
			for (const id of ids) {
				const code = findCode.get(id)?.code;
				if (typeof code !== "string")
					throw new Error(`Missing postcode area ${id}`);
				areaCodes.set(id, code);
			}
			const sorted = [...areaCodes].sort((a, b) =>
				a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0,
			);
			const codePositions = new Map(sorted.map(([id], at) => [id, at]));
			const several: NonNullable<PostcodeAreaColumn["several"]> = {};
			for (const match of matches) {
				const at = String(match.postcode_position);
				(several[at] ??= []).push([
					codePositions.get(Number(match.area_id))!,
					match.containment as "boundary" | "interior",
					Number(match.distance_cm),
				]);
			}
			releases[column.key] = {
				codes: sorted.map(([, code]) => code),
				area: rows.map((row, at) =>
					row[column.area] === null
						? several[at]
							? SEVERAL
							: NONE
						: codePositions.get(Number(row[column.area]))!,
				),
				distanceCm: distancesOf(position),
				...(matches.length ? { several } : {}),
			};
		}
		const shard: PostcodeAreasShard = {
			schemaVersion: 1,
			district,
			postcodeShard,
			releases,
		};
		return `${JSON.stringify(shard)}\n`;
	};
}
