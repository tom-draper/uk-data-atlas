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
export const POSTCODE_AREA_LAYOUT = "4";

/** Refuse a database built before distances could fall back to another release. */
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

/**
 * The release position each distance column falls back to when null, or null
 * for a column that always holds its own value. Fallbacks point at earlier
 * positions, so one pass in order resolves every chain.
 */
export function distanceFallbacks(database: SqlReader) {
	return new Map(
		database
			.prepare(
				"SELECT position, distanceFallback FROM postcode_area_releases",
			)
			.all()
			.map((row) => [
				Number(row.position),
				row.distanceFallback === null
					? null
					: Number(row.distanceFallback),
			]),
	);
}

export function readPostcodeAreaShard(
	database: SqlReader,
	artifact: PostcodeAreasArtifact,
	path: string,
	table = "postcodes",
	verify = true,
): string {
	const entry = artifact.shards.find((e) => e.path === path);
	if (!entry) throw new Error(`Missing postcode area shard ${path}`);
	const index: PostcodeIndexArtifact = JSON.parse(
		unpackText(
			database
				.prepare(
					"SELECT payload FROM payloads WHERE id = 'postcode-index'",
				)
				.get()!.payload,
		)!,
	);
	const rows = database
		.prepare(
			`SELECT p.*, s.* FROM ${table} p JOIN postcode_area_set s ON s.id = p.area_set_id WHERE ${postcodeDistrictWhere} ORDER BY p.postcode`,
		)
		.all(
			entry.district,
			`${entry.district}\x7f`,
			entry.district.length + 3,
		);
	const columns = postcodeAreaColumns(artifact);
	const fallbacks = distanceFallbacks(database);
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
	const findCode = database.prepare(
		"SELECT a.code FROM area_version v JOIN area a ON a.id = v.area_id WHERE v.id = ?",
	);
	for (const [position, column] of columns.entries()) {
		const matches = database
			.prepare(
				"SELECT * FROM postcode_area_matches WHERE district = ? AND releasePosition = ? ORDER BY postcodePosition, position",
			)
			.all(entry.district, position);
		const ids = new Set<number>();
		for (const row of rows)
			if (row[column.area] !== null) ids.add(Number(row[column.area]));
		for (const match of matches) ids.add(Number(match.areaId));
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
			const at = String(match.postcodePosition);
			(several[at] ??= []).push([
				codePositions.get(Number(match.areaId))!,
				match.containment as "boundary" | "interior",
				Number(match.distanceCm),
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
		district: entry.district,
		postcodeShard: index.shards.find((e) => e.district === entry.district)!
			.contentHash,
		releases,
	};
	const text = `${JSON.stringify(shard)}\n`;
	if (verify) {
		const expected = database
			.prepare(
				"SELECT sha256 FROM postcode_area_shard_hash WHERE district = ?",
			)
			.get(entry.district)?.sha256;
		if (expected !== sha256(text))
			throw new Error(`Invalid SQLite postcode area shard ${path}`);
	}
	return text;
}
