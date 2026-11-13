import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * The DuckDB views file for the Parquet folders of a release
 * (docs/database-roadmap.md, task 16). It has no DuckDB dependency, so the
 * dist script can render it too.
 */

const text = (value: string) => `'${value.replaceAll("'", "''")}'`;
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

/** Every `.parquet` file under `root`, as `<module>/parquet/<table>.parquet`. */
export const listParquet = (root: string): string[] =>
	readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.flatMap((module) => {
			try {
				return readdirSync(join(root, module.name, "parquet"))
					.filter((name) => name.endsWith(".parquet"))
					.map((name) =>
						relative(root, join(root, module.name, "parquet", name))
							.split(sep)
							.join("/"),
					);
			} catch {
				return [];
			}
		})
		.sort();

/**
 * The DuckDB views file for the Parquet folders that are present. A table kept
 * by several modules (observation, series) becomes one view over all of them.
 * Paths are relative to the release root, where the file is run. A view is
 * created only for tables with files, because `read_parquet` of a missing path
 * fails when the view is created.
 */
export const renderDuckdbViews = (files: readonly string[]): string => {
	const byTable = new Map<string, string[]>();
	for (const file of [...files].sort()) {
		const name = file.slice(file.lastIndexOf("/") + 1, -".parquet".length);
		byTable.set(name, [...(byTable.get(name) ?? []), file]);
	}
	const lines = [
		"-- Views over the Parquet folders in this download.",
		"-- Run from the release root: duckdb -init duckdb-views.sql",
		"",
	];
	for (const [table, paths] of [...byTable].sort(([a], [b]) =>
		a < b ? -1 : 1,
	))
		lines.push(
			`CREATE OR REPLACE VIEW ${quote(table)} AS SELECT * FROM read_parquet([${paths.map(text).join(", ")}], union_by_name = true);`,
		);
	return `${lines.join("\n")}\n`;
};
