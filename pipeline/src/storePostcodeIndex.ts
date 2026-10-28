import { copyFileSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { postcodeTables } from "@uk-data-atlas/atlas-runtime/storage";
import { postcodeIndexMismatch } from "@uk-data-atlas/postcodes";
import type { PostcodeIndexArtifact } from "@uk-data-atlas/geography/postcode-index-types";
import { writeSqliteTables } from "@uk-data-atlas/artifacts";
import { artifactDirectory } from "@uk-data-atlas/atlas-runtime/storage";

export const storePostcodeIndex = (
	root: string,
	artifact: PostcodeIndexArtifact,
	readShard: (path: string) => string,
) => {
	const mismatch = postcodeIndexMismatch(artifact);
	if (mismatch) throw new Error(`The postcode index ${mismatch}`);
	const path = join(root, "data/build/atlas.sqlite");
	const temporary = `${path}.postcodes.tmp`;
	try {
		copyFileSync(path, temporary);
		const database = new DatabaseSync(temporary);
		try {
			database.exec(
				"BEGIN; DROP VIEW IF EXISTS postcodes_decoded; DROP TABLE IF EXISTS postcodes;",
			);
			writeSqliteTables(database, postcodeTables(artifact, readShard));
			database
				.prepare(
					"INSERT OR REPLACE INTO payloads (id, payload) VALUES (?, ?)",
				)
				.run(
					"postcode-index",
					`${JSON.stringify(artifact, null, "\t")}\n`,
				);
			database.exec("COMMIT");
		} finally {
			database.close();
		}
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
	const publicRoot = artifactDirectory(root);
	rmSync(join(publicRoot, "postcodes"), { recursive: true, force: true });
	for (const filename of ["postcode-index.json", "postcode-index.json.gz"])
		rmSync(join(publicRoot, filename), { force: true });
	return path;
};
