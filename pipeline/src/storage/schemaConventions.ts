import type { DatabaseSync } from "node:sqlite";

/**
 * The naming and separation rules every SQLite database in `data/build`
 * follows (#713): STRICT tables, snake_case identifiers, singular table
 * names, and no build metadata or payload documents in domain tables. Build
 * metadata is its own tables (named `*_metadata` or `*_build`), kept in the
 * file beside the database, so a table like that here is a finding too.
 *
 * `checkSchemaConventions` returns one finding per violation. A finding the
 * schema still carries on purpose is listed in an allowlist with the
 * follow-up that removes it, and an allowlist entry that no longer matches
 * anything is itself a finding, so the lists only shrink.
 */

export type ConventionRule =
	| "strict"
	| "camel-case"
	| "plural-table"
	| "build-metadata"
	| "payload-table";

/**
 * Allowed exceptions, by rule: `table`, `table.column`, or `table.*` for every
 * column of a table (the wide postcode tables have one column per release).
 */
export type ConventionAllowlist = Partial<
	Record<ConventionRule, readonly string[]>
>;

export type ConventionFinding = { rule: ConventionRule; subject: string };

/** Columns that describe how a file was built, not what the data says. */
const BUILD_METADATA_COLUMN =
	/(^|_)(artifact|artifact_path|content_hash|compiled_sha256|sha256|bytes|byte_count)$/;

/**
 * Tables that exist to hold build metadata. They belong in the build
 * metadata file beside a database (`x-build.sqlite`), where the rule does not
 * apply, so one in a domain database is a finding.
 */
const BUILD_METADATA_TABLE =
	/(_metadata|_build|_shard_hash)$|^(boundary_registry|crosswalk_coverage_entry|statistics_read_path|statistics_observation_fallback)$|^statistics_selector/;

/** Tables that hold documents as blobs or text, which are build payloads. */
const PAYLOAD_TABLE = /^payloads?$/;

const isCamelCase = (name: string): boolean => /[a-z0-9][A-Z]/.test(name);

/** Plural unless the last word ends in ss, us or is, or is `series`. */
const isPlural = (name: string): boolean =>
	/s$/.test(name) && !/(ss|us|is)$/.test(name) && !/(^|_)series$/.test(name);

export const checkSchemaConventions = (
	database: DatabaseSync,
	allowlist: ConventionAllowlist = {},
): ConventionFinding[] => {
	const found: ConventionFinding[] = [];
	const used = new Set<string>();
	const report = (rule: ConventionRule, subject: string): void => {
		const table = subject.split(".")[0]!;
		const key = [subject, `${table}.*`].find((candidate) =>
			(allowlist[rule] ?? []).includes(candidate),
		);
		if (key === undefined) found.push({ rule, subject });
		else used.add(`${rule}:${key}`);
	};
	const objects = database
		.prepare(
			`SELECT name, type, strict FROM pragma_table_list
			 WHERE schema = 'main' AND name NOT LIKE 'sqlite_%'
			 ORDER BY name`,
		)
		.all() as Array<{ name: string; type: string; strict: number }>;
	for (const { name, type, strict } of objects) {
		// FTS5 virtual and shadow tables are managed by SQLite and cannot be
		// STRICT; they follow the FTS naming, so no other rule applies.
		if (type === "virtual" || type === "shadow") continue;
		if (type === "table" && !strict) report("strict", name);
		if (isCamelCase(name)) report("camel-case", name);
		if (type === "table" && isPlural(name)) report("plural-table", name);
		if (type === "table" && PAYLOAD_TABLE.test(name))
			report("payload-table", name);
		if (type === "table" && BUILD_METADATA_TABLE.test(name))
			report("build-metadata", name);
		const columns = database
			.prepare("SELECT name FROM pragma_table_info(?)")
			.all(name) as Array<{ name: string }>;
		for (const column of columns) {
			const subject = `${name}.${column.name}`;
			if (isCamelCase(column.name)) report("camel-case", subject);
			if (type === "table" && BUILD_METADATA_COLUMN.test(column.name))
				report("build-metadata", subject);
		}
	}
	for (const [rule, subjects] of Object.entries(allowlist))
		for (const subject of subjects)
			if (!used.has(`${rule}:${subject}`))
				found.push({
					rule: rule as ConventionRule,
					subject: `${subject} (stale allowlist entry)`,
				});
	return found;
};
