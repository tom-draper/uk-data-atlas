import { randomUUID } from "node:crypto";
import { copyFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { replaceObservationTables } from "../src/atlasObservationTables";
import { sha256 } from "../src/contentHash";
import { observationArtifactName, type DataCatalog } from "../src/dataCatalog";

/** Publish one complete observation generation while preserving other atlas tables. */
export function storeObservations(
	root: string,
	catalog: DataCatalog,
	artifacts: Iterable<readonly [string, string]>,
) {
	const path = join(root, "data/build/atlas.sqlite");
	const temporary = `${path}.observations.${randomUUID()}.tmp`;
	const required = new Set(
		catalog.measures.flatMap((measure) =>
			measure.sources.map((source) =>
				observationArtifactName(measure.id, source),
			),
		),
	);
	const fingerprints: Array<readonly [string, string]> = [];
	const entries: Array<readonly [string, string]> = [];
	for (const [id, text] of artifacts) {
		if (!required.delete(id))
			throw new Error(
				`Unexpected or duplicate observation artifact: ${id}`,
			);
		JSON.parse(text);
		fingerprints.push([id, sha256(text)]);
		entries.push([id, text]);
	}
	if (required.size)
		throw new Error(
			`Missing observation artifacts: ${[...required].join(", ")}`,
		);
	try {
		copyFileSync(path, temporary);
		const database = new DatabaseSync(temporary);
		try {
			database.exec(
				"PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF",
			);
			replaceObservationTables(database, entries);
			database.exec(`BEGIN;
CREATE TABLE observation_catalogue (dataCatalogHash TEXT NOT NULL, generationHash TEXT NOT NULL);`);
			database
				.prepare("INSERT INTO observation_catalogue VALUES (?, ?)")
				.run(
					catalog.contentHash,
					sha256(
						JSON.stringify({
							dataCatalogHash: catalog.contentHash,
							artifacts: fingerprints.sort(([a], [b]) =>
								a.localeCompare(b),
							),
						}),
					),
				);
			// Return the pages the replaced tables held, so the file shrinks.
			database.exec("COMMIT; VACUUM");
		} finally {
			database.close();
		}
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
	const directory = join(root, "services/api/public");
	for (const name of readdirSync(directory)) {
		if (/(?:-observations|-table)\.json(?:\.gz)?$/.test(name))
			rmSync(join(directory, name), { force: true });
	}
	return path;
}
