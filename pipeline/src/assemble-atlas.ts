import { randomUUID } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	readFileSync,
	renameSync,
	rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { observationBuildPath } from "./observation-build-path";
import {
	artifactDirectory,
	writePostcodeAreas,
} from "@uk-data-atlas/atlas-runtime/storage";
import type { PostcodeAreasArtifact } from "@uk-data-atlas/geography/postcode-area-types";
import {
	postcodeAreasDirectory,
	readPostcodeAreaComponent,
} from "./storePostcodeAreas";
import { geographyCatalogues } from "@uk-data-atlas/atlas-runtime/areas";

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

export function assembleAtlas(root: string) {
	const directory = join(root, "data/build");
	const path = join(directory, "atlas.sqlite");
	const components = [
		join(directory, "atlas-base.sqlite"),
		observationBuildPath(root),
		join(directory, "postcode-index.sqlite"),
		join(directory, "website-assets.sqlite"),
	] as const;
	for (const component of components)
		if (!existsSync(component))
			throw new Error(`Missing atlas component ${component}`);
	const payloads = JSON.parse(
		readFileSync(join(directory, "geography-payloads.json"), "utf8"),
	) as Array<{ id: string; payload: string }>;
	const postcodeAreas = JSON.parse(
		readFileSync(
			join(postcodeAreasDirectory(root), "manifest.json"),
			"utf8",
		),
	) as PostcodeAreasArtifact;
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		copyFileSync(components[0], temporary);
		const database = new DatabaseSync(temporary);
		try {
			database
				.prepare("ATTACH DATABASE ? AS observations_component")
				.run(components[1]);
			database
				.prepare("ATTACH DATABASE ? AS postcode_component")
				.run(components[2]);
			database
				.prepare("ATTACH DATABASE ? AS website_component")
				.run(components[3]);
			const objects = database
				.prepare(
					"SELECT type, name, sql FROM observations_component.sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid",
				)
				.all() as Array<{ type: string; name: string; sql: string }>;
			database.exec(
				"PRAGMA foreign_keys = OFF; PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; BEGIN",
			);
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
			database.exec("COMMIT; ANALYZE; BEGIN");
			const insertPayload = database.prepare(
				"INSERT OR REPLACE INTO payloads (id, payload) VALUES (?, ?)",
			);
			for (const { id, payload } of payloads)
				insertPayload.run(id, payload);
			const postcode = database
				.prepare(
					"SELECT payload FROM postcode_component.payloads WHERE id = 'postcode-index'",
				)
				.get();
			if (!postcode) throw new Error("Missing postcode index payload");
			const schema = database
				.prepare(
					"SELECT sql FROM postcode_component.sqlite_schema WHERE type = 'table' AND name = 'postcodes'",
				)
				.get();
			if (!schema?.sql) throw new Error("Missing postcode index table");
			database.exec(String(schema.sql));
			database.exec(
				"INSERT INTO main.postcodes SELECT * FROM postcode_component.postcodes",
			);
			insertPayload.run("postcode-index", postcode.payload!);
			database.exec("COMMIT; PRAGMA foreign_keys = ON; BEGIN");
			writePostcodeAreas(database, postcodeAreas, (name) =>
				readPostcodeAreaComponent(root, name),
			);
			insertPayload.run("postcode-areas", JSON.stringify(postcodeAreas));
			database.exec(`CREATE TABLE IF NOT EXISTS website_assets (
			kind TEXT NOT NULL, id TEXT NOT NULL, sha256 TEXT NOT NULL,
			gzip BLOB NOT NULL, PRIMARY KEY (kind, id)
		) WITHOUT ROWID`);
			database.exec(
				"INSERT INTO main.website_assets SELECT * FROM website_component.website_assets",
			);
			database.exec("COMMIT; VACUUM");
		} finally {
			database.close();
		}
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
	for (const id of geographyCatalogues)
		rmSync(join(artifactDirectory(root), `${id}.json`), { force: true });
	const publicRoot = artifactDirectory(root);
	for (const name of ["postcodes", "postcode-areas"])
		rmSync(join(publicRoot, name), { recursive: true, force: true });
	for (const filename of [
		"postcode-index.json",
		"postcode-index.json.gz",
		"postcode-areas.json",
		"postcode-areas.json.gz",
	])
		rmSync(join(publicRoot, filename), { force: true });
	for (const name of ["atlas-lookups", "atlas-pages", "precompiled"])
		rmSync(join(root, "public/data", name), {
			recursive: true,
			force: true,
		});
	return path;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath)
	console.log(
		`Assembled atlas components into ${assembleAtlas(resolve(dirname(scriptPath), "../.."))}`,
	);
