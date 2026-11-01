import { randomUUID } from "node:crypto";
import { copyFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { observationBuildPath } from "./observation-build-path";

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

export function assembleObservations(root: string) {
	const path = join(root, "data/build/atlas.sqlite");
	const component = observationBuildPath(root);
	const temporary = `${path}.observations.${randomUUID()}.tmp`;
	try {
		copyFileSync(path, temporary);
		const database = new DatabaseSync(temporary);
		try {
			database
				.prepare("ATTACH DATABASE ? AS observations_component")
				.run(component);
			const objects = database
				.prepare(
					"SELECT type, name, sql FROM observations_component.sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid",
				)
				.all() as Array<{ type: string; name: string; sql: string }>;
			const existing = database
				.prepare(
					"SELECT type, name FROM main.sqlite_schema WHERE type IN ('table', 'view') AND (name LIKE 'observation\\_%' ESCAPE '\\' OR name = 'observations' OR name LIKE 'observations\\_%' ESCAPE '\\') ORDER BY type DESC",
				)
				.all() as Array<{ type: string; name: string }>;
			const hasObservations = existing.some(
				({ type, name }) => type === "table" && name === "observations",
			);
			const observationNames = new Set(
				existing
					.filter(({ type }) => type === "table")
					.map(({ name }) => name),
			);
			const previousStats =
				hasObservations &&
				database
					.prepare(
						"SELECT 1 FROM main.sqlite_schema WHERE name = 'sqlite_stat1'",
					)
					.get()
					? database
							.prepare(
								"SELECT tbl, idx, stat FROM main.sqlite_stat1",
							)
							.all()
							.filter(
								({ tbl }) => !observationNames.has(String(tbl)),
							)
					: null;
			database.exec(
				"PRAGMA foreign_keys = OFF; PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; BEGIN",
			);
			for (const { type, name } of existing)
				database.exec(`DROP ${type} ${quote(name)}`);
			for (const object of objects.filter(
				({ type }) => type === "table",
			)) {
				database.exec(object.sql);
				database.exec(
					`INSERT INTO main.${quote(object.name)} SELECT * FROM observations_component.${quote(object.name)}`,
				);
			}
			for (const object of objects.filter(
				({ type }) => type === "index" || type === "view",
			))
				database.exec(object.sql);
			database.exec("COMMIT; ANALYZE");
			if (previousStats) {
				const stats = database
					.prepare(
						"SELECT tbl, idx, stat FROM observations_component.sqlite_stat1",
					)
					.all();
				database.exec("DELETE FROM main.sqlite_stat1");
				const insert = database.prepare(
					"INSERT INTO main.sqlite_stat1 VALUES (?, ?, ?)",
				);
				for (const row of [...previousStats, ...stats])
					insert.run(row.tbl!, row.idx!, row.stat!);
			}
			database.exec("VACUUM");
		} finally {
			database.close();
		}
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
	return path;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath)
	console.log(
		`Assembled observations into ${assembleObservations(resolve(dirname(scriptPath), "../.."))}`,
	);
