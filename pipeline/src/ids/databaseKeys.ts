import type { DatabaseSync, SQLOutputValue } from "node:sqlite";
import { type IdNamespace, type IdRegistries } from "./idRegistries.ts";

type Row = Record<string, SQLOutputValue>;

/**
 * Where each namespace's ids are in a database, and the natural key each is
 * for. Rows come ordered so that keys sharing a registry prefix are together,
 * which keeps the registry's lookup tables few.
 */
export const DATABASE_KEYS: Record<
	IdNamespace,
	{
		sql: string;
		key: (row: Row) => string[];
		/** The file a new key is written to, where not the key's own prefix. */
		group?: (row: Row) => string;
	}
> = {
	release: {
		sql: "SELECT position AS id, geography, id AS release FROM area_releases ORDER BY position",
		key: (row) => [String(row.geography), String(row.release)],
	},
	geography: {
		sql: "SELECT id, slug FROM geography ORDER BY id",
		key: (row) => [String(row.slug)],
	},
	area: {
		// An area is written with the release that first had it.
		sql: "SELECT a.id AS id, g.slug AS geography, a.code AS code, fr.geography AS introduced_geography, fr.id AS introduced_release FROM area a JOIN geography g ON g.id = a.geography_id JOIN (SELECT area_id, min(id) AS version_id FROM area_version GROUP BY area_id) f ON f.area_id = a.id JOIN area_version fv ON fv.id = f.version_id JOIN area_releases fr ON fr.position = fv.release_id ORDER BY g.id, a.id",
		key: (row) => [String(row.geography), String(row.code)],
		group: (row) =>
			`${String(row.introduced_geography)}/${String(row.introduced_release)}`,
	},
	area_version: {
		sql: "SELECT v.id AS id, r.geography AS geography, r.id AS release, a.code AS code FROM area_version v JOIN area a ON a.id = v.area_id JOIN area_releases r ON r.position = v.release_id ORDER BY v.release_id, v.id",
		key: (row) => [
			String(row.geography),
			String(row.release),
			String(row.code),
		],
	},
	crosswalk: {
		sql: "SELECT id, slug FROM crosswalk ORDER BY id",
		key: (row) => [String(row.slug)],
	},
	source: {
		sql: "SELECT id, publisher, url, licence FROM source ORDER BY id",
		key: (row) => [JSON.stringify([row.publisher, row.url, row.licence])],
	},
	dataset: {
		sql: "SELECT id, slug FROM dataset ORDER BY id",
		key: (row) => [String(row.slug)],
	},
	measure: {
		sql: "SELECT id, slug FROM measure ORDER BY id",
		key: (row) => [String(row.slug)],
	},
	dimension: {
		sql: "SELECT id, slug FROM dimension ORDER BY id",
		key: (row) => [String(row.slug)],
	},
	dimension_member: {
		sql: "SELECT m.id AS id, d.slug AS dimension, m.code AS code FROM dimension_member m JOIN dimension d ON d.id = m.dimension_id ORDER BY m.id",
		key: (row) => [String(row.dimension), String(row.code)],
	},
	period: {
		sql: "SELECT id, label FROM period ORDER BY id",
		key: (row) => [String(row.label)],
	},
	series: {
		sql: "SELECT id, key FROM series ORDER BY id",
		key: (row) => [String(row.key)],
	},
	election: {
		sql: "SELECT e.id AS id, d.slug AS dataset, e.label AS label FROM election e JOIN dataset d ON d.id = e.dataset_id ORDER BY e.id",
		key: (row) => [String(row.dataset), String(row.label)],
	},
	party: {
		sql: "SELECT id, code FROM party ORDER BY id",
		key: (row) => [String(row.code)],
	},
	contest: {
		sql: "SELECT c.id AS id, d.slug AS dataset, e.label AS election, r.geography AS geography, r.id AS release, a.code AS code FROM contest c JOIN election e ON e.id = c.election_id JOIN dataset d ON d.id = e.dataset_id JOIN area_version v ON v.id = c.area_version_id JOIN area a ON a.id = v.area_id JOIN area_releases r ON r.position = v.release_id ORDER BY e.id, c.id",
		key: (row) => [
			String(row.dataset),
			String(row.election),
			String(row.geography),
			String(row.release),
			String(row.code),
		],
	},
};

const hasTable = (database: DatabaseSync, name: string) =>
	database
		.prepare(
			"SELECT 1 AS found FROM sqlite_schema WHERE name = ? AND type = 'table'",
		)
		.get(name) !== undefined;

const tableOf = (sql: string) => /\bFROM (\w+)/.exec(sql)![1]!;

export type IdMismatch = {
	namespace: IdNamespace;
	id: number;
	key: string[];
	registered: number | undefined;
};

/**
 * Every id in the database against the registry. A database id the registry
 * gives to another key, or to none, is an id that changed or was never
 * assigned. Namespaces the database has no table for are skipped, so an
 * older database can be checked as far as it goes.
 */
export const findIdMismatches = (
	database: DatabaseSync,
	ids: IdRegistries,
	{
		limit = 10,
		namespaces = Object.keys(DATABASE_KEYS) as IdNamespace[],
	}: { limit?: number; namespaces?: IdNamespace[] } = {},
) => {
	const mismatches: IdMismatch[] = [];
	const checked: Partial<Record<IdNamespace, number>> = {};
	for (const namespace of namespaces) {
		const { sql, key } = DATABASE_KEYS[namespace];
		if (!hasTable(database, tableOf(sql))) continue;
		let count = 0;
		for (const row of database.prepare(sql).iterate()) {
			count++;
			const fields = key(row);
			const registered = ids.registries[namespace].id(...fields);
			if (registered !== Number(row.id)) {
				mismatches.push({
					namespace,
					id: Number(row.id),
					key: fields,
					registered,
				});
				if (mismatches.length >= limit) return { mismatches, checked };
			}
		}
		checked[namespace] = count;
	}
	return { mismatches, checked };
};

/** Refuse a database whose ids are not the registry's. */
export const verifyStableIds = (database: DatabaseSync, ids: IdRegistries) => {
	const { mismatches, checked } = findIdMismatches(database, ids);
	if (mismatches.length > 0)
		throw new Error(
			`Ids differ from the id registry:\n${mismatches
				.map(
					(m) =>
						`  ${m.namespace} ${m.id} is ${m.key.join("/")}, which the registry gives ${m.registered ?? "no id"}`,
				)
				.join("\n")}`,
		);
	return checked;
};
