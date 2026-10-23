import { mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { sha256 } from "../src/contentHash";

export const fixtureObservationDatabase = (directory: string) =>
	join(directory, "atlas.sqlite");

/** Insert bytes directly so malformed and legacy payloads can exercise the readers. */
export function writeObservationFixture(path: string, text: string) {
	const databasePath = fixtureObservationDatabase(dirname(path));
	mkdirSync(dirname(databasePath), { recursive: true });
	const database = new DatabaseSync(databasePath);
	try {
		database.exec(`CREATE TABLE IF NOT EXISTS observation_artifacts (id TEXT PRIMARY KEY, payload TEXT NOT NULL, payloadHash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS observation_catalogue (dataCatalogHash TEXT NOT NULL, generationHash TEXT NOT NULL);
INSERT INTO observation_catalogue SELECT 'sha256:catalogue', 'fixture-generation' WHERE NOT EXISTS (SELECT 1 FROM observation_catalogue);`);
		database
			.prepare(
				"INSERT OR REPLACE INTO observation_artifacts VALUES (?, ?, ?)",
			)
			.run(basename(path, ".json"), text, sha256(text));
	} finally {
		database.close();
	}
}

export function removeObservationFixture(path: string) {
	const database = new DatabaseSync(
		fixtureObservationDatabase(dirname(path)),
	);
	try {
		database
			.prepare("DELETE FROM observation_artifacts WHERE id = ?")
			.run(basename(path, ".json"));
	} finally {
		database.close();
	}
}
