import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AreaInventory, AreaReleaseArtifact } from "@uk-data-atlas/areas";
import type { DatabaseSync } from "node:sqlite";
import type { SqliteTable } from "@uk-data-atlas/artifacts";

/** The legacy `areas` shape, read from `area` and `area_version`. */
export const AREAS_VIEW = `SELECT v.id, v.release_id AS releasePosition, a.code, v.in_inventory AS inInventory, v.name, v.aliases, v.area_m2 AS areaM2, v.population FROM area_version v JOIN area a ON a.id = v.area_id`;

/**
 * Add an area version that is not in its release's inventory, such as a code
 * a crosswalk or postcode lookup names. Its area is added if it is new.
 */
export const addAreaVersion = (database: DatabaseSync) => {
	const addArea = database.prepare(
		"INSERT OR IGNORE INTO area (geography_id, code) SELECT g.id, ? FROM area_releases r JOIN geography g ON g.slug = r.geography WHERE r.position = ?",
	);
	const addVersion = database.prepare(
		"INSERT INTO area_version (area_id, release_id, name, aliases, in_inventory) SELECT a.id, r.position, ?, ?, 0 FROM area_releases r JOIN geography g ON g.slug = r.geography JOIN area a ON a.geography_id = g.id AND a.code = ? WHERE r.position = ?",
	);
	return (
		releasePosition: number,
		code: string,
		name: string,
		aliases: string | null,
	) => {
		addArea.run(code, releasePosition);
		if (addVersion.run(name, aliases, code, releasePosition).changes !== 1)
			throw new Error(
				`Missing area release ${releasePosition} for ${code}`,
			);
	};
};

/** Area versions whose release is for another geography than their area. */
export const AREA_GEOGRAPHY_MISMATCH = `SELECT count(*) AS n FROM area_version v JOIN area a ON a.id = v.area_id JOIN area_releases r ON r.position = v.release_id JOIN geography g ON g.id = a.geography_id WHERE g.slug <> r.geography`;

export const areaTables = (directory: string): Record<string, SqliteTable> => {
	const inventory: AreaInventory = JSON.parse(
		readFileSync(join(directory, "area-inventory.json"), "utf8"),
	);
	const geographies = new Map<string, number>();
	for (const release of inventory.releases)
		if (!geographies.has(release.geography))
			geographies.set(release.geography, geographies.size + 1);
	const areaIds = new Map<string, number>();
	const areaKey = (geography: string, code: string) =>
		`${geographies.get(geography)}\t${code}`;
	function* releaseAreas() {
		for (const [releasePosition, release] of inventory.releases.entries()) {
			if (release.status !== "available") continue;
			const artifact: AreaReleaseArtifact = JSON.parse(
				readFileSync(join(directory, release.artifact), "utf8"),
			);
			if (
				artifact.schemaVersion !== 1 ||
				artifact.contentHash !== release.contentHash ||
				artifact.areas.length !== release.recordCount
			)
				throw new Error(
					`Invalid area release ${release.geography}/${release.id}`,
				);
			for (const area of artifact.areas)
				yield { releasePosition, geography: release.geography, area };
		}
	}
	// Area ids follow first appearance, in release order.
	function* areas() {
		for (const { geography, area } of releaseAreas()) {
			const key = areaKey(geography, area.code);
			if (areaIds.has(key)) continue;
			areaIds.set(key, areaIds.size + 1);
			yield [areaIds.size, geographies.get(geography)!, area.code];
		}
	}
	// Version ids match the row order of the old `areas` table.
	function* versions() {
		let id = 0;
		for (const { releasePosition, geography, area } of releaseAreas())
			yield [
				++id,
				areaIds.get(areaKey(geography, area.code))!,
				releasePosition,
				area.name,
				null,
				null,
				area.aliases === undefined
					? null
					: JSON.stringify(area.aliases),
				1,
			];
	}
	return {
		area_inventory: {
			columns: [
				"schemaVersion INTEGER NOT NULL",
				"contentHash TEXT NOT NULL",
				"boundaryRegistryHash TEXT NOT NULL",
			],
			rows: [
				[
					inventory.schemaVersion,
					inventory.contentHash,
					inventory.boundaryRegistryHash,
				],
			],
		},
		area_releases: {
			columns: [
				"geography TEXT NOT NULL",
				"id TEXT NOT NULL",
				"position INTEGER NOT NULL UNIQUE",
				"status TEXT NOT NULL",
				"recordCount INTEGER",
				"artifact TEXT",
				"contentHash TEXT",
				"codeProperty TEXT",
				"nameProperty TEXT",
				"derivedFrom TEXT",
				"reason TEXT",
			],
			key: ["geography", "id"],
			rows: inventory.releases.map((release, position) =>
				release.status === "available"
					? [
							release.geography,
							release.id,
							position,
							release.status,
							release.recordCount,
							release.artifact,
							release.contentHash,
							release.codeProperty,
							release.nameProperty,
							release.derivedFrom === undefined
								? null
								: JSON.stringify(release.derivedFrom),
							null,
						]
					: [
							release.geography,
							release.id,
							position,
							release.status,
							null,
							null,
							null,
							null,
							null,
							null,
							release.reason,
						],
			),
		},
		geography: {
			rowid: true,
			strict: true,
			columns: ["id INTEGER", "slug TEXT NOT NULL UNIQUE"],
			key: ["id"],
			rows: [...geographies].map(([slug, id]) => [id, slug]),
		},
		area: {
			rowid: true,
			strict: true,
			columns: [
				"id INTEGER",
				"geography_id INTEGER NOT NULL REFERENCES geography(id)",
				"code TEXT NOT NULL",
			],
			key: ["id"],
			rows: areas(),
			// Code first, so a lookup by code alone uses the index.
			constraints: ["UNIQUE (code, geography_id)"],
		},
		area_version: {
			rowid: true,
			strict: true,
			columns: [
				"id INTEGER",
				"area_id INTEGER NOT NULL REFERENCES area(id)",
				"release_id INTEGER NOT NULL REFERENCES area_releases(position)",
				"name TEXT NOT NULL",
				"area_m2 REAL",
				"population REAL",
				"aliases TEXT",
				"in_inventory INTEGER NOT NULL CHECK (in_inventory IN (0, 1))",
			],
			key: ["id"],
			rows: versions(),
			constraints: ["UNIQUE (release_id, area_id)"],
			views: { areas: AREAS_VIEW },
		},
	};
};
