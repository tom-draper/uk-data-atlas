import type { DatabaseSync } from "node:sqlite";
import { DATABASE_KEYS } from "./databaseKeys.ts";
import { idNamespaces, type IdRegistries } from "./idRegistries.ts";

const hasTable = (database: DatabaseSync, sql: string) =>
	database
		.prepare(
			"SELECT 1 AS found FROM sqlite_schema WHERE name = ? AND type = 'table'",
		)
		.get(/\bFROM (\w+)/.exec(sql)![1]!) !== undefined;

/**
 * Start empty registries from a database, so that the ids it already has are
 * the ones the registries give. Each namespace's ids must run from its first
 * without a gap, or `fillGaps` numbers the missing ones with keys that can
 * never match anything. A namespace the database has no table for stays
 * empty.
 */
export const seedIdRegistries = (
	database: DatabaseSync,
	ids: IdRegistries,
	{ fillGaps = false }: { fillGaps?: boolean } = {},
) => {
	const seeded: Partial<Record<(typeof idNamespaces)[number], number>> = {};
	for (const namespace of idNamespaces) {
		const registry = ids.registries[namespace];
		const { sql, key } = DATABASE_KEYS[namespace];
		if (!hasTable(database, sql)) continue;
		if (registry.size !== 0)
			throw new Error(
				`Id registry ${namespace} already holds ids: seed only an empty one`,
			);
		let expected = registry.first;
		for (const row of database
			.prepare(`SELECT * FROM (${sql}) ORDER BY id`)
			.iterate()) {
			const id = Number(row.id);
			if (id > expected && !fillGaps)
				throw new Error(
					`${namespace} ids skip from ${expected - 1} to ${id}, which a registry cannot hold`,
				);
			for (; expected < id; expected++)
				registry.assign(
					...Array.from(
						{ length: registry.fields },
						() => `unused-${expected}`,
					),
				);
			const fields = key(row);
			const assigned = registry.assign(...fields);
			if (assigned !== id)
				throw new Error(
					`${namespace} ${id} and ${assigned} are both ${fields.join("/")}, so one key has two ids`,
				);
			expected++;
		}
		seeded[namespace] = registry.size;
	}
	return seeded;
};
