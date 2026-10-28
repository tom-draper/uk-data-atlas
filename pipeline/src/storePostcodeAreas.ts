import { copyFileSync, renameSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { writePostcodeAreas } from "../../shared/atlasPostcodeAreas";
import { sha256 } from "../../shared/contentHash";
import type { PostcodeAreasArtifact } from "@uk-data-atlas/geography/postcode-area-types";
import { artifactDirectory } from "../../shared/dataLayout";

/** Publish complete tables atomically, preserving the other atlas data. */
function store(
	root: string,
	id: string,
	write: (database: DatabaseSync) => void,
) {
	const path = join(root, "data/build/atlas.sqlite");
	const temporary = `${path}.${id}.${randomUUID()}.tmp`;
	try {
		copyFileSync(path, temporary);
		const database = new DatabaseSync(temporary);
		try {
			database.exec("PRAGMA foreign_keys = ON; BEGIN");
			write(database);
			database.exec("COMMIT");
			if (id === "postcode-areas") database.exec("VACUUM");
		} finally {
			database.close();
		}
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
	const publicRoot = artifactDirectory(root);
	rmSync(join(publicRoot, id), { recursive: true, force: true });
	for (const suffix of [".json", ".json.gz"])
		rmSync(join(publicRoot, `${id}${suffix}`), { force: true });
	return path;
}

export function storePostcodeAreas(
	root: string,
	artifact: PostcodeAreasArtifact,
	readShard: (path: string) => string,
) {
	return store(root, "postcode-areas", (database) => {
		writePostcodeAreas(database, artifact, readShard);
		database
			.prepare("INSERT OR REPLACE INTO payloads VALUES (?, ?)")
			.run("postcode-areas", JSON.stringify(artifact));
	});
}
