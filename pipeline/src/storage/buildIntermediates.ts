import type {
	AreaInventory,
	AreaRecord,
	AreaReleaseArtifact,
} from "@uk-data-atlas/areas";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "@uk-data-atlas/relationships";
import type { NamedLocationInventory } from "@uk-data-atlas/places";
import {
	atlasBaseDatabasePath,
	openReadOnlyDatabase,
} from "@uk-data-atlas/atlas-db";
import {
	readSqliteCrosswalk,
	readSqliteCrosswalkInventory,
} from "@uk-data-atlas/relationships";
import { readSqliteNamedLocationInventory } from "@uk-data-atlas/atlas-runtime/places";
import { readSqliteAreaInventory } from "@uk-data-atlas/areas";

/**
 * What stages after `atlas-sqlite` read instead of the compiled JSON in
 * `data/build/artifacts`: areas, crosswalks and named locations, from the
 * tables `atlas-sqlite` wrote to `atlas-base.sqlite`.
 *
 * Every function takes the repository root and, to read another file, a
 * database path (default `atlasBaseDatabasePath`). A stage that calls these
 * must depend on `atlas-sqlite` in the stage graph, so that the stage runs
 * after the tables exist and runs again when they change.
 *
 * Reads go through the shared read-only connection, so statements are
 * prepared once and a stage holds no connection of its own. Nothing here
 * keeps what it returns: areas and crosswalks come one at a time, so a stage
 * holds as much as it chooses to keep.
 */

export type AreaField = "code" | "name" | "aliases";

type AvailableRelease = Extract<
	AreaInventory["releases"][number],
	{ status: "available" }
>;

type Endpoint = { geography: string; boundaryRelease: string };

const AREA_COLUMNS: Record<AreaField, string> = {
	code: "a.code",
	name: "v.name",
	aliases: "v.aliases",
};

/** The area inventory the build wrote, without the areas themselves. */
export const readAreaInventory = (
	repositoryRoot: string,
	databasePath = atlasBaseDatabasePath(repositoryRoot),
): AreaInventory => readSqliteAreaInventory(repositoryRoot, databasePath);

/**
 * The areas of one release, in inventory order, a row at a time. Only the
 * requested fields are read (`code`, `name` and `aliases` by default); an
 * area with no aliases has no `aliases` key, as in the compiled artifact.
 * The release must be in the inventory with its recorded area count.
 */
export function* readAreas<F extends AreaField = AreaField>(
	repositoryRoot: string,
	options: {
		geography: string;
		release: string;
		fields?: readonly F[];
	},
	databasePath = atlasBaseDatabasePath(repositoryRoot),
): Generator<Pick<AreaRecord, F>> {
	const fields = (options.fields ?? ["code", "name", "aliases"]) as F[];
	const database = openReadOnlyDatabase(databasePath);
	try {
		const release = database
			.prepare(
				"SELECT id, recordCount FROM area_releases WHERE geography = ? AND release = ? AND status = 'available'",
			)
			.get(options.geography, options.release);
		if (!release)
			throw new Error(
				`Unknown area release ${options.geography}/${options.release}`,
			);
		const columns = fields
			.map((field) => `${AREA_COLUMNS[field]} AS ${field}`)
			.join(", ");
		let count = 0;
		for (const row of database
			.prepare(
				`SELECT ${columns} FROM area_version v JOIN area a ON a.id = v.area_id WHERE v.release_id = ? AND v.in_inventory = 1 ORDER BY v.inventory_position`,
			)
			.iterate(release.id)) {
			count += 1;
			const area: Record<string, unknown> = {};
			for (const field of fields) {
				const value = row[field];
				if (field === "aliases") {
					if (value !== null)
						area.aliases = JSON.parse(value as string);
				} else area[field] = value;
			}
			yield area as Pick<AreaRecord, F>;
		}
		if (count !== release.recordCount)
			throw new Error(
				`Invalid area release ${options.geography}/${options.release}`,
			);
	} finally {
		database.release();
	}
}

/**
 * Every available area release as the compiled artifact, one at a time.
 * Hold on to a release only as long as it is needed.
 */
export function* readAreaReleaseArtifacts(
	repositoryRoot: string,
	inventory: AreaInventory = readAreaInventory(repositoryRoot),
	databasePath = atlasBaseDatabasePath(repositoryRoot),
): Generator<AreaReleaseArtifact> {
	for (const release of inventory.releases) {
		if (release.status !== "available") continue;
		yield areaReleaseArtifact(repositoryRoot, release, databasePath);
	}
}

const areaReleaseArtifact = (
	repositoryRoot: string,
	release: AvailableRelease,
	databasePath: string,
): AreaReleaseArtifact => ({
	schemaVersion: 1,
	contentHash: release.contentHash,
	geography: release.geography,
	boundaryRelease: release.id,
	codeProperty: release.codeProperty,
	nameProperty: release.nameProperty,
	...(release.derivedFrom === undefined
		? {}
		: { derivedFrom: release.derivedFrom }),
	areas: [
		...readAreas(
			repositoryRoot,
			{ geography: release.geography, release: release.id },
			databasePath,
		),
	],
});

/** The crosswalk inventory the build wrote, without the records. */
export const readCrosswalkInventory = (
	repositoryRoot: string,
	databasePath = atlasBaseDatabasePath(repositoryRoot),
): CrosswalkInventory =>
	readSqliteCrosswalkInventory(repositoryRoot, databasePath);

const sameEndpoint = (left: Endpoint, right: Endpoint) =>
	left.geography === right.geography &&
	left.boundaryRelease === right.boundaryRelease;

/**
 * The crosswalks from one release to another, in inventory order. Usually
 * one; a pair can have several, built by different methods.
 */
export function* readCrosswalk(
	repositoryRoot: string,
	from: Endpoint,
	to: Endpoint,
	inventory: CrosswalkInventory = readCrosswalkInventory(repositoryRoot),
	databasePath = atlasBaseDatabasePath(repositoryRoot),
): Generator<CrosswalkArtifact> {
	for (const entry of inventory.crosswalks)
		if (sameEndpoint(entry.from, from) && sameEndpoint(entry.to, to))
			yield readCrosswalkById(repositoryRoot, entry, databasePath);
}

/** One crosswalk with all its records. */
export const readCrosswalkById = (
	repositoryRoot: string,
	entry: CrosswalkInventory["crosswalks"][number],
	databasePath = atlasBaseDatabasePath(repositoryRoot),
): CrosswalkArtifact =>
	readSqliteCrosswalk(repositoryRoot, entry, databasePath).artifact;

/**
 * Every crosswalk in inventory order, one at a time. The previous crosswalk
 * is unreachable once the next is requested, unless the caller keeps it.
 */
export function* readCrosswalks(
	repositoryRoot: string,
	inventory: CrosswalkInventory = readCrosswalkInventory(repositoryRoot),
	databasePath = atlasBaseDatabasePath(repositoryRoot),
): Generator<CrosswalkArtifact> {
	for (const entry of inventory.crosswalks)
		yield readCrosswalkById(repositoryRoot, entry, databasePath);
}

/**
 * The named locations with their members. A location's geometry is read
 * when its `geometry` is first used, not here.
 */
export const readNamedLocations = (
	repositoryRoot: string,
	databasePath = atlasBaseDatabasePath(repositoryRoot),
): NamedLocationInventory =>
	readSqliteNamedLocationInventory(repositoryRoot, databasePath);

/** Whether each source has one target, and each target one source. */
export type CrosswalkShape = { forward: boolean; reverse: boolean };

/**
 * The shape of every crosswalk, by id, from the edges alone. This is the
 * whole of what path discovery reads of a crosswalk, so no record is loaded.
 * `forward` is true when every source has exactly one target, so a source
 * with none (which has a `crosswalk_source` row and no edge) breaks it.
 */
export const readCrosswalkShapes = (
	repositoryRoot: string,
	databasePath = atlasBaseDatabasePath(repositoryRoot),
): Map<string, CrosswalkShape> => {
	const database = openReadOnlyDatabase(databasePath);
	try {
		return new Map(
			database
				.prepare(
					`SELECT c.slug AS id,
						NOT EXISTS (SELECT 1 FROM crosswalk_source s WHERE s.crosswalk_id = c.id AND NOT EXISTS (SELECT 1 FROM crosswalk_edge e WHERE e.crosswalk_id = c.id AND e.from_version_id = s.from_version_id))
						AND NOT EXISTS (SELECT 1 FROM crosswalk_edge e WHERE e.crosswalk_id = c.id GROUP BY e.from_version_id HAVING count(*) > 1) AS forward,
						NOT EXISTS (SELECT 1 FROM crosswalk_edge e WHERE e.crosswalk_id = c.id GROUP BY e.to_version_id HAVING count(*) > 1) AS reverse
					FROM crosswalk c ORDER BY c.inventory_position`,
				)
				.all()
				.map((row) => [
					row.id as string,
					{ forward: row.forward === 1, reverse: row.reverse === 1 },
				]),
		);
	} finally {
		database.release();
	}
};
