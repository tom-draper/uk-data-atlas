import type { SqlReader } from "./readOnlyDatabase.ts";
import { sha256 } from "@uk-data-atlas/artifacts";
import { postcodeDistrictWhere } from "./atlasPostcodeShard.ts";
import {
	NONE,
	SEVERAL,
	releaseKey,
	type PostcodeAreasArtifact,
	type PostcodeAreasShard,
	type PostcodeAreaColumn,
} from "@uk-data-atlas/geography/postcode-area-types";
import type { PostcodeIndexArtifact } from "@uk-data-atlas/geography/postcode-index-types";

/** The `meta` key and value that mark the postcode area table layout. */
export const POSTCODE_AREA_LAYOUT_KEY = "postcodeAreaLayout";
export const POSTCODE_AREA_LAYOUT = "3";

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
			`SELECT p.*, s.* FROM ${table} p JOIN postcode_area_set s ON s.id = p.area_set_id WHERE ${postcodeDistrictWhere} ORDER BY p.postcode`,
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
			distanceCm: distancesOf(position),
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
