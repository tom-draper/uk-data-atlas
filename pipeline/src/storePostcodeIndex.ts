import { renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { postcodeTables } from "@uk-data-atlas/atlas-runtime/storage";
import { postcodeIndexMismatch } from "@uk-data-atlas/postcodes";
import type { PostcodeIndexArtifact } from "@uk-data-atlas/geography/postcode-index-types";
import { writeSqliteTables } from "@uk-data-atlas/artifacts";

export const storePostcodeIndex = (
	root: string,
	artifact: PostcodeIndexArtifact,
	readShard: (path: string) => string,
) => {
	const mismatch = postcodeIndexMismatch(artifact);
	if (mismatch) throw new Error(`The postcode index ${mismatch}`);
	const path = join(root, "data/build/postcode-index.sqlite");
	const temporary = `${path}.postcodes.tmp`;
	try {
		rmSync(temporary, { force: true });
		const database = new DatabaseSync(temporary);
		try {
			database.exec(
				"BEGIN; CREATE TABLE payloads (id TEXT PRIMARY KEY, payload TEXT NOT NULL) WITHOUT ROWID;",
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
	return path;
};
