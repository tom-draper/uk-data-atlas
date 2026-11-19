import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { compilePostcodeAreas } from "../../src/postcodes/postcodeAreaCompiler";
import { storePostcodeAreas } from "../../src/postcodes/storePostcodeAreas";
import {
	payloadTable,
	writeBuildMetadata,
} from "../../src/storage/buildMetadataWriter";
import {
	buildMetadataPathOf,
	closeAllReadOnlyDatabases,
	readBuildPayload,
} from "@uk-data-atlas/atlas-db";
import type { PostcodeIndexArtifact } from "@uk-data-atlas/geography";

/** The build metadata of a fixture's base database, with no documents of its own. */
export function writeBaseBuildMetadata(
	root: string,
	payloads: Iterable<readonly [string, string]> = [],
) {
	writeBuildMetadata(join(root, "data/build/atlas-base.sqlite"), {
		payload: payloadTable(payloads),
	});
}

export function writeEmptyPostcodeComponent(root: string) {
	const database = new DatabaseSync(
		join(root, "data/build/postcode-index.sqlite"),
	);
	database.exec(
		`CREATE TABLE postcode (postcode TEXT PRIMARY KEY, easting INTEGER, northing INTEGER, quality TEXT, country TEXT, introduced INTEGER, terminated INTEGER, large_user TEXT) WITHOUT ROWID`,
	);
	database.close();
	writeBuildMetadata(join(root, "data/build/postcode-index.sqlite"), {
		payload: payloadTable([
			["postcode-index", '{"contentHash":"empty","shards":[]}'],
		]),
	});
	writeEmptyPostcodeAreas(root);
}

export function writeEmptyPostcodeAreas(root: string) {
	writeFileSync(
		join(root, "data/build/statistics-read-path.json"),
		JSON.stringify({
			schemaVersion: 1,
			dataCatalogHash: "fixture",
			statistics: {},
			observations: {},
		}),
	);
	const base = new DatabaseSync(join(root, "data/build/atlas-base.sqlite"));
	base.exec(`CREATE TABLE IF NOT EXISTS geography (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE);
		CREATE TABLE IF NOT EXISTS area_release (id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
		CREATE TABLE IF NOT EXISTS area (id INTEGER PRIMARY KEY, geography_id INTEGER, code TEXT, UNIQUE(geography_id, code));
		CREATE TABLE IF NOT EXISTS area_version (id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER, name TEXT, area_m2 REAL, population REAL, aliases TEXT, in_inventory INTEGER, UNIQUE(release_id, area_id));
		CREATE VIEW IF NOT EXISTS areas AS SELECT v.id, a.code, v.name FROM area_version v JOIN area a ON a.id = v.area_id;`);
	base.close();
	if (
		!existsSync(
			buildMetadataPathOf(join(root, "data/build/atlas-base.sqlite")),
		)
	)
		writeBaseBuildMetadata(root);
	const payload = readBuildPayload(
		join(root, "data/build/postcode-index.sqlite"),
		"postcode-index",
	)!;
	closeAllReadOnlyDatabases();
	const index = JSON.parse(payload) as PostcodeIndexArtifact;
	const compiled = compilePostcodeAreas(index, []);
	const texts = new Map(compiled.files.map(({ path, text }) => [path, text]));
	storePostcodeAreas(root, compiled.artifact, (path) => texts.get(path)!);
}
