import { DatabaseSync } from "node:sqlite";
import { readAtlasPayload } from "./atlasSqlite.ts";
import { readPostcodeAreaShard } from "./atlasPostcodeAreaShard.ts";
import type { PostcodeAreasArtifact } from "@uk-data-atlas/geography/postcode-area-types";
import { atlasDatabasePath } from "./dataLayout.ts";

export function readSqlitePostcodeAreas(
	repositoryRoot: string,
): PostcodeAreasArtifact {
	return JSON.parse(readAtlasPayload(repositoryRoot, "postcode-areas"));
}

export function readSqlitePostcodeAreaShard(
	repositoryRoot: string,
	path: string,
): string {
	const database = new DatabaseSync(atlasDatabasePath(repositoryRoot), {
		readOnly: true,
	});
	try {
		const artifact: PostcodeAreasArtifact = JSON.parse(
			String(
				database
					.prepare(
						"SELECT payload FROM payloads WHERE id = 'postcode-areas'",
					)
					.get()!.payload,
			),
		);
		return readPostcodeAreaShard(database, artifact, path);
	} finally {
		database.close();
	}
}
