import { type DatabaseSync } from "node:sqlite";
import { sha256 } from "@uk-data-atlas/artifacts";
import { postcodeDistrictWhere } from "./atlasPostcodeShard";
import {
	NONE,
	SEVERAL,
	releaseKey,
	type PostcodeAreasArtifact,
	type PostcodeAreasShard,
	type PostcodeAreaColumn,
} from "@uk-data-atlas/geography/postcode-area-types";
import type { PostcodeIndexArtifact } from "@uk-data-atlas/geography/postcode-index-types";

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
