import { copyFileSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
	buildArtifactPath,
	geographyCatalogues,
} from "@uk-data-atlas/atlas-runtime/areas";
import { artifactDirectory } from "@uk-data-atlas/atlas-runtime/storage";

/** Finalise catalogue payloads after analysis has read the base database. */
export const buildGeographyCatalogues = (repositoryRoot: string) => {
	const payloads = geographyCatalogues.map((id) => ({
		id,
		payload: readFileSync(
			buildArtifactPath(repositoryRoot, `${id}.json`),
			"utf8",
		),
	}));
	const path = join(repositoryRoot, "data/build/atlas.sqlite");
	const temporary = `${path}.geography.tmp`;
	try {
		copyFileSync(path, temporary);
		const database = new DatabaseSync(temporary);
		try {
			database.exec("BEGIN");
			const insert = database.prepare(
				"INSERT OR REPLACE INTO payloads (id, payload) VALUES (?, ?)",
			);
			for (const { id, payload } of payloads) insert.run(id, payload);
			database.exec("COMMIT");
		} finally {
			database.close();
		}
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
	for (const id of geographyCatalogues)
		rmSync(join(artifactDirectory(repositoryRoot), `${id}.json`), {
			force: true,
		});
	return path;
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath)
	console.log(
		`Stored geography catalogues in ${buildGeographyCatalogues(resolve(dirname(scriptPath), "../.."))}`,
	);
