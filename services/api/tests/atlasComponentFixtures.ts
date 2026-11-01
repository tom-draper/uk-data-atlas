import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function writeEmptyObservationComponent(root: string) {
	const database = new DatabaseSync(
		join(root, "data/build/observations.sqlite"),
	);
	database.exec("CREATE TABLE observations (id INTEGER); ANALYZE");
	database.close();
}

export function writeEmptyPostcodeComponent(root: string) {
	const database = new DatabaseSync(
		join(root, "data/build/postcode-index.sqlite"),
	);
	database.exec(
		"CREATE TABLE payloads (id TEXT PRIMARY KEY, payload TEXT NOT NULL) WITHOUT ROWID; INSERT INTO payloads VALUES ('postcode-index', '{}'); CREATE TABLE postcodes (postcode TEXT PRIMARY KEY, easting INTEGER, northing INTEGER, quality TEXT, country TEXT, introduced INTEGER, terminated INTEGER, largeUser TEXT) WITHOUT ROWID",
	);
	database.close();
}
