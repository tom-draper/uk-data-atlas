import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { compilePostcodeAreas } from "../src/postcodes/postcodeAreaCompiler";
import { storePostcodeAreas } from "../src/postcodes/storePostcodeAreas";
import type { PostcodeIndexArtifact } from "@uk-data-atlas/geography/postcode-index-types";

export function writeEmptyPostcodeComponent(root: string) {
	const database = new DatabaseSync(
		join(root, "data/build/postcode-index.sqlite"),
	);
	database.exec(
		`CREATE TABLE payloads (id TEXT PRIMARY KEY, payload TEXT NOT NULL) WITHOUT ROWID; INSERT INTO payloads VALUES ('postcode-index', '{"contentHash":"empty","shards":[]}'); CREATE TABLE postcodes (postcode TEXT PRIMARY KEY, easting INTEGER, northing INTEGER, quality TEXT, country TEXT, introduced INTEGER, terminated INTEGER, largeUser TEXT) WITHOUT ROWID`,
	);
	database.close();
	writeEmptyPostcodeAreas(root);
	writeEmptyWebsiteComponent(root);
}

export function writeEmptyWebsiteComponent(root: string) {
	const database = new DatabaseSync(
		join(root, "data/build/website-assets.sqlite"),
	);
	database.exec(
		"CREATE TABLE website_asset (kind TEXT NOT NULL, id TEXT NOT NULL, sha256 TEXT NOT NULL, gzip BLOB NOT NULL, PRIMARY KEY (kind, id)) WITHOUT ROWID",
	);
	database.close();
}

export function writeEmptyPostcodeAreas(root: string) {
	const base = new DatabaseSync(join(root, "data/build/atlas-base.sqlite"));
	base.exec(`CREATE TABLE IF NOT EXISTS geography (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE);
		CREATE TABLE IF NOT EXISTS area_releases (position INTEGER PRIMARY KEY, geography TEXT, id TEXT);
		CREATE TABLE IF NOT EXISTS area (id INTEGER PRIMARY KEY, geography_id INTEGER, code TEXT, UNIQUE(geography_id, code));
		CREATE TABLE IF NOT EXISTS area_version (id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER, name TEXT, area_m2 REAL, population REAL, aliases TEXT, in_inventory INTEGER, UNIQUE(release_id, area_id));
		CREATE VIEW IF NOT EXISTS areas AS SELECT v.id, a.code, v.name FROM area_version v JOIN area a ON a.id = v.area_id;`);
	base.close();
	const database = new DatabaseSync(
		join(root, "data/build/postcode-index.sqlite"),
		{ readOnly: true },
	);
	const payload = database
		.prepare("SELECT payload FROM payloads WHERE id = 'postcode-index'")
		.get()!.payload;
	database.close();
	const index = JSON.parse(String(payload)) as PostcodeIndexArtifact;
	const compiled = compilePostcodeAreas(index, []);
	const texts = new Map(compiled.files.map(({ path, text }) => [path, text]));
	storePostcodeAreas(root, compiled.artifact, (path) => texts.get(path)!);
}
