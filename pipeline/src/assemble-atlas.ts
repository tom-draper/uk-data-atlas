import { randomUUID } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
	artifactDirectory,
	closeReadOnlyDatabase,
	packText,
	unpackText,
} from "@uk-data-atlas/atlas-runtime/storage";
import { publishVacuumed, writePostcodeAreas } from "./storage/index.ts";
import type { PostcodeAreasArtifact } from "@uk-data-atlas/geography/postcode-area-types";
import {
	postcodeAreasDirectory,
	readPostcodeAreaComponent,
} from "./postcodes/storePostcodeAreas.ts";
import { geographyCatalogues } from "@uk-data-atlas/atlas-runtime/areas";

export function assembleAtlas(root: string) {
	const directory = join(root, "data/build");
	const path = join(directory, "atlas.sqlite");
	const components = [
		join(directory, "atlas-base.sqlite"),
		join(directory, "postcode-index.sqlite"),
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
				.prepare("ATTACH DATABASE ? AS postcode_component")
				.run(components[1]);
			database.exec(
				"PRAGMA foreign_keys = OFF; PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; BEGIN",
			);
			const insertStored = database.prepare(
				"INSERT OR REPLACE INTO payloads (id, payload) VALUES (?, ?)",
			);
			const insertPayload = (id: string, text: string) =>
				insertStored.run(id, packText(text));
			for (const { id, payload } of payloads) insertPayload(id, payload);
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
			insertPayload("postcode-index", unpackText(postcode.payload)!);
			database.exec("COMMIT; PRAGMA foreign_keys = ON; BEGIN");
			writePostcodeAreas(database, postcodeAreas, (name) =>
				readPostcodeAreaComponent(root, name),
			);
			insertPayload("postcode-areas", JSON.stringify(postcodeAreas));
			database.exec("COMMIT");
		} finally {
			database.close();
		}
		// The build's one vacuum of atlas.sqlite: written once beside the
		// release, then renamed over it.
		publishVacuumed(temporary, path, {
			// Readers in this process must not keep the file about to be replaced.
			beforeReplace: () => closeReadOnlyDatabase(path),
		});
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
