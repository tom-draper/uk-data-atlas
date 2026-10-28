import { mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { replaceObservationTables } from "../../../pipeline/src/atlasObservationTables";
import { rebuildObservationText } from "@uk-data-atlas/atlas-runtime/storage";

export const fixtureObservationDatabase = (directory: string) =>
	join(directory, "atlas.sqlite");

/** The artifacts stored so far, as the text they read back to. */
function storedEntries(database: DatabaseSync) {
	const exists = database
		.prepare(
			"SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'observation_series'",
		)
		.get();
	return exists
		? database
				.prepare("SELECT artifactId FROM observation_series")
				.all()
				.map(
					(row) =>
						[
							String(row.artifactId),
							rebuildObservationText(
								database,
								String(row.artifactId),
							)!.text,
						] as const,
				)
		: [];
}

/**
 * Store one artifact among the others, as the build would. The text is
 * normalised to what the build writes, and a shared table is named for the
 * artifact it is stored as. Text that is not an observation artifact stores
 * nothing, but still leaves a database to read.
 */
export function writeObservationFixture(path: string, text: string) {
	const databasePath = fixtureObservationDatabase(dirname(path));
	mkdirSync(dirname(databasePath), { recursive: true });
	const id = basename(path, ".json");
	const database = new DatabaseSync(databasePath);
	try {
		const entries = storedEntries(database).filter(([name]) => name !== id);
		const artifact = JSON.parse(text);
		if (artifact?.periods || artifact?.kind === "measure-table")
			entries.push([
				id,
				`${JSON.stringify(artifact.kind === "measure-table" ? { ...artifact, id } : artifact)}\n`,
			]);
		replaceObservationTables(database, entries);
		database.exec(
			"CREATE TABLE IF NOT EXISTS observation_catalogue (dataCatalogHash TEXT NOT NULL, generationHash TEXT NOT NULL);" +
				"INSERT INTO observation_catalogue SELECT 'sha256:catalogue', 'fixture-generation' WHERE NOT EXISTS (SELECT 1 FROM observation_catalogue);",
		);
	} finally {
		database.close();
	}
}

export function removeObservationFixture(path: string) {
	const database = new DatabaseSync(
		fixtureObservationDatabase(dirname(path)),
	);
	try {
		const id = basename(path, ".json");
		replaceObservationTables(
			database,
			storedEntries(database).filter(([name]) => name !== id),
		);
		database.exec(
			"CREATE TABLE IF NOT EXISTS observation_catalogue (dataCatalogHash TEXT NOT NULL, generationHash TEXT NOT NULL);" +
				"INSERT INTO observation_catalogue SELECT 'sha256:catalogue', 'fixture-generation' WHERE NOT EXISTS (SELECT 1 FROM observation_catalogue);",
		);
	} finally {
		database.close();
	}
}
