import { randomUUID } from "node:crypto";
import { copyFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
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
	try {
		copyFileSync(path, temporary);
		const database = new DatabaseSync(temporary);
		try {
			database.exec(`BEGIN;
DROP TABLE IF EXISTS observation_artifacts;
CREATE TABLE observation_artifacts (id TEXT PRIMARY KEY, payload TEXT NOT NULL, payloadHash TEXT NOT NULL);
DROP TABLE IF EXISTS observation_catalogue;
CREATE TABLE observation_catalogue (dataCatalogHash TEXT NOT NULL, generationHash TEXT NOT NULL);`);
			const insert = database.prepare(
				"INSERT INTO observation_artifacts VALUES (?, ?, ?)",
			);
			for (const [id, text] of artifacts) {
				if (!required.delete(id))
					throw new Error(
						`Unexpected or duplicate observation artifact: ${id}`,
					);
				JSON.parse(text);
				const hash = sha256(text);
				fingerprints.push([id, hash]);
				insert.run(id, text, hash);
			}
			if (required.size)
				throw new Error(
					`Missing observation artifacts: ${[...required].join(", ")}`,
				);
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
			database.exec("COMMIT");
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
