import { AREA_INVENTORY_VIEW } from "./deprecatedViews.ts";
import { IdRegistries } from "../ids/idRegistries.ts";
import { join } from "node:path";
import type { AreaInventory, AreaReleaseArtifact } from "@uk-data-atlas/areas";
import type { DatabaseSync } from "node:sqlite";
import type { SqliteTable } from "@uk-data-atlas/artifacts";
import { readJsonSync } from "../lib/json.ts";

/** The legacy `areas` shape, read from `area` and `area_version`. */
export const AREAS_VIEW = `SELECT v.id, v.release_id AS releasePosition, a.code, v.in_inventory AS inInventory, v.name, v.aliases, v.area_m2 AS areaM2, v.population FROM area_version v JOIN area a ON a.id = v.area_id`;

/**
 * The stable public key of an area version: `geography`, `release` and `code`
 * identify it for good. `area_version_id` is the compact integer the other
 * tables use, assigned once from `pipeline/ids/area-version.txt`.
 */
export const AREA_VERSION_VIEW = `SELECT v.id AS area_version_id, g.slug AS geography, r.release AS release, a.code, v.name, v.aliases, v.area_m2, v.population, v.in_inventory, v.inventory_position FROM area_version v JOIN area a ON a.id = v.area_id JOIN geography g ON g.id = a.geography_id JOIN area_releases r ON r.id = v.release_id`;

/**
 * Add an area version that is not in its release's inventory, such as a code
 * a crosswalk or postcode lookup names. Its area is added if it is new. Both
 * take their ids from the registry, so the same code in the same release is
 * the same id however the build met it.
 */
export const addAreaVersion = (database: DatabaseSync, ids: IdRegistries) => {
	const findRelease = database.prepare(
		"SELECT geography, release FROM area_releases WHERE id = ?",
	);
	const findGeography = database.prepare(
		"SELECT id FROM geography WHERE slug = ?",
	);
	const findArea = database.prepare("SELECT code FROM area WHERE id = ?");
	const addArea = database.prepare(
		"INSERT INTO area (id, geography_id, code) VALUES (?, ?, ?)",
	);
	const findVersion = database.prepare(
		"SELECT 1 AS found FROM area_version WHERE id = ?",
	);
	const addVersion = database.prepare(
		"INSERT INTO area_version (id, area_id, release_id, name, aliases, in_inventory) VALUES (?, ?, ?, ?, ?, 0)",
	);
	return (
		releasePosition: number,
		code: string,
		name: string,
		aliases: string | null,
	) => {
		const release = findRelease.get(releasePosition);
		if (!release)
			throw new Error(
				`Missing area release ${releasePosition} for ${code}`,
			);
		const geography = String(release.geography);
		const areaId = ids.area.assignIn(
			`${geography}/${String(release.release)}`,
			geography,
			code,
		);
		const area = findArea.get(areaId);
		if (!area) {
			const geographyId = findGeography.get(geography)?.id;
			if (geographyId === undefined)
				throw new Error(`Missing geography ${geography}`);
			addArea.run(areaId, geographyId as number, code);
		} else if (area.code !== code)
			throw new Error(
				`Area id ${areaId} is ${String(area.code)} in the database but ${geography}/${code} in the id registry`,
			);
		const versionId = ids.areaVersion.assign(
			geography,
			String(release.release),
			code,
		);
		if (findVersion.get(versionId))
			throw new Error(
				`Area version id ${versionId} for ${geography}/${String(release.release)}/${code} is already used`,
			);
		addVersion.run(versionId, areaId, releasePosition, name, aliases);
	};
};

/** Area versions whose release is for another geography than their area. */
export const AREA_GEOGRAPHY_MISMATCH = `SELECT count(*) AS n FROM area_version v JOIN area a ON a.id = v.area_id JOIN area_releases r ON r.id = v.release_id JOIN geography g ON g.id = a.geography_id WHERE g.slug <> r.geography`;

/**
 * `ids` gives each key the id it was first given. The default numbers keys in
 * the order they are met, which is right for a database built from nothing.
 */
export const areaTables = (
	directory: string,
	ids: IdRegistries = IdRegistries.memory(),
): Record<string, SqliteTable> => {
	const inventory: AreaInventory = readJsonSync(
		join(directory, "area-inventory.json"),
	);
	const geographies = new Map<string, number>();
	for (const release of inventory.releases)
		if (!geographies.has(release.geography))
			geographies.set(
				release.geography,
				ids.geography.assign(release.geography),
			);
	const releasePositions = inventory.releases.map((release) =>
		ids.release.assign(release.geography, release.id),
	);
	function* releaseAreas() {
		for (const [
			inventoryPosition,
			release,
		] of inventory.releases.entries()) {
			if (release.status !== "available") continue;
			const artifact: AreaReleaseArtifact = readJsonSync(
				join(directory, release.artifact),
			);
			if (
				artifact.schemaVersion !== 1 ||
				artifact.contentHash !== release.contentHash ||
				artifact.areas.length !== release.recordCount
			)
				throw new Error(
					`Invalid area release ${release.geography}/${release.id}`,
				);
			for (const [position, area] of artifact.areas.entries())
				yield {
					release,
					releasePosition: releasePositions[inventoryPosition]!,
					position,
					area,
				};
		}
	}
	// Each area keeps the id it was first given, so these rows are in release
	// order but the ids need not be.
	function* areas() {
		const seen = new Set<number>();
		for (const { release, area } of releaseAreas()) {
			const id = ids.area.assignIn(
				`${release.geography}/${release.id}`,
				release.geography,
				area.code,
			);
			if (seen.has(id)) continue;
			seen.add(id);
			yield [id, geographies.get(release.geography)!, area.code];
		}
	}
	function* versions() {
		for (const {
			release,
			releasePosition,
			position,
			area,
		} of releaseAreas())
			yield [
				ids.areaVersion.assign(
					release.geography,
					release.id,
					area.code,
				),
				ids.area.id(release.geography, area.code)!,
				releasePosition,
				area.name,
				null,
				null,
				area.aliases === undefined
					? null
					: JSON.stringify(area.aliases),
				1,
				position,
			];
	}
	return {
		area_inventory_metadata: {
			views: { area_inventory: AREA_INVENTORY_VIEW },
			columns: [
				"schema_version INTEGER NOT NULL",
				"content_hash TEXT NOT NULL",
				"boundary_registry_hash TEXT NOT NULL",
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
				// The release's stable id, assigned once and never reused. It is
				// not an order: `inventory_position` is.
				"id INTEGER NOT NULL UNIQUE",
				"geography TEXT NOT NULL",
				// The boundary release's name, such as `2024-12-uk-bgc`.
				"release TEXT NOT NULL",
				"inventory_position INTEGER NOT NULL UNIQUE",
				"status TEXT NOT NULL",
				"recordCount INTEGER",
				"artifact TEXT",
				"contentHash TEXT",
				"codeProperty TEXT",
				"nameProperty TEXT",
				"derivedFrom TEXT",
				"reason TEXT",
			],
			key: ["geography", "release"],
			rows: inventory.releases.map((release, inventoryPosition) =>
				release.status === "available"
					? [
							releasePositions[inventoryPosition]!,
							release.geography,
							release.id,
							inventoryPosition,
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
							releasePositions[inventoryPosition]!,
							release.geography,
							release.id,
							inventoryPosition,
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
				"release_id INTEGER NOT NULL REFERENCES area_releases(id)",
				"name TEXT NOT NULL",
				"area_m2 REAL",
				"population REAL",
				"aliases TEXT",
				"in_inventory INTEGER NOT NULL CHECK (in_inventory IN (0, 1))",
				// The area's place in its release's artifact, which ids no longer
				// follow once a release has a code added.
				"inventory_position INTEGER",
			],
			key: ["id"],
			rows: versions(),
			constraints: [
				"UNIQUE (release_id, area_id)",
				"CHECK ((inventory_position IS NOT NULL) = (in_inventory = 1))",
			],
			views: { areas: AREAS_VIEW, v_area_version: AREA_VERSION_VIEW },
		},
	};
};
