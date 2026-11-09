import {
	ATLAS_BOUNDARY_VINTAGES,
	type AtlasBoundaryVintages,
} from "@uk-data-atlas/catalogue";
import type { DatabaseSync } from "node:sqlite";
import type { AreaRelease, AreaIndex } from "@uk-data-atlas/measures";

const vintages = ATLAS_BOUNDARY_VINTAGES as AtlasBoundaryVintages &
	Partial<Record<string, Readonly<Record<number, string>>>>;

export function createStatisticsAreaLookup() {
	/** Release positions and area ids, read from the tables written before these. */
	const releases = new Map<string, number>();
	const releaseAreas = new Map<
		number,
		Map<string, { id: number; name: string }>
	>();
	const releasePosition = (database: DatabaseSync, release: AreaRelease) => {
		const key = `${release.geography}:${release.id}`;
		let position = releases.get(key);
		if (position === undefined) {
			const row = database
				.prepare(
					"SELECT id, status FROM area_releases WHERE geography = ? AND release = ?",
				)
				.get(release.geography, release.id);
			if (!row || row.status !== "available")
				throw new Error(`Unknown or unavailable area release ${key}`);
			position = Number(row.id);
			releases.set(key, position);
		}
		return position;
	};
	const areaLookup = (database: DatabaseSync, position: number) => {
		let areas = releaseAreas.get(position);
		if (!areas) {
			areas = new Map(
				database
					.prepare(
						"SELECT v.id, a.code, v.name FROM area_version v JOIN area a ON a.id = v.area_id WHERE v.release_id = ?",
					)
					.all(position)
					.map((row) => [
						String(row.code),
						{ id: Number(row.id), name: String(row.name) },
					]),
			);
			releaseAreas.set(position, areas);
		}
		return areas;
	};
	const area = (
		database: DatabaseSync,
		dataset: string,
		release: AreaRelease,
		code: string,
	) => {
		const found = areaLookup(
			database,
			releasePosition(database, release),
		).get(code);
		if (!found)
			throw new Error(
				`Unknown area ${code} in ${release.geography}/${release.id} for dataset ${dataset}`,
			);
		return found;
	};
	const releasesOf = new Map<string, { position: number; year: number }[]>();
	const byName = new Map<number, Map<string, number | null>>();
	/**
	 * The area a name is exactly, in the available release of a geography
	 * nearest the year (the later one on a tie). Nothing when the geography
	 * has no release, the name is not in it, or two areas share it.
	 */
	const namedArea = (
		database: DatabaseSync,
		geography: string,
		year: number,
		name: string,
	) => {
		let releases = releasesOf.get(geography);
		if (!releases) {
			releases = database
				.prepare(
					"SELECT id, release FROM area_releases WHERE geography = ? AND status = 'available'",
				)
				.all(geography)
				.map((row) => ({
					position: Number(row.id),
					year: Number.parseInt(String(row.release), 10),
				}));
			releasesOf.set(geography, releases);
		}
		const nearest = releases.reduce<(typeof releases)[number] | undefined>(
			(best, release) => {
				if (!best) return release;
				const gap = Math.abs(release.year - year);
				const bestGap = Math.abs(best.year - year);
				return gap < bestGap ||
					(gap === bestGap && release.year > best.year)
					? release
					: best;
			},
			undefined,
		);
		if (!nearest) return undefined;
		let names = byName.get(nearest.position);
		if (!names) {
			names = new Map();
			for (const { id, name: label } of areaLookup(
				database,
				nearest.position,
			).values())
				names.set(label, names.has(label) ? null : id);
			byName.set(nearest.position, names);
		}
		return names.get(name) ?? undefined;
	};
	const areaIndex = (database: DatabaseSync): AreaIndex => {
		const available = database
			.prepare(
				"SELECT geography, release FROM area_releases WHERE status = 'available'",
			)
			.all()
			.map((row) => ({
				geography: String(row.geography),
				id: String(row.release),
			}));
		const find = (geography: string, year: number) => {
			const declared = vintages[geography]?.[year];
			if (declared)
				return available.find(
					(release) =>
						release.geography === geography &&
						release.id === declared,
				);
			const matches = available.filter(
				(release) =>
					release.geography === geography &&
					release.id.startsWith(`${year}-`),
			);
			if (matches.length > 1)
				throw new Error(
					`No single ${geography} release for ${year} (${matches.length} found)`,
				);
			return matches[0];
		};
		return {
			find,
			release(geography, year) {
				const found = find(geography, year);
				if (!found)
					throw new Error(
						`No single ${geography} release for ${year} (0 found)`,
					);
				return found;
			},
			has: (release, code) =>
				areaLookup(database, releasePosition(database, release)).has(
					code,
				),
		};
	};

	return { releasePosition, area, areaIndex, namedArea };
}
