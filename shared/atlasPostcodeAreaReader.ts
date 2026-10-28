import { DatabaseSync } from "node:sqlite";
import { readAtlasPayload } from "./atlasSqlite";
import { readPostcodeAreaShard } from "./atlasPostcodeAreaShard";
import type { PostcodeAreasArtifact } from "@uk-data-atlas/geography/postcode-area-types";
import { atlasDatabasePath, repositoryRootOf } from "./dataLayout";

export function readSqlitePostcodeAreas(
	apiRoot: string,
): PostcodeAreasArtifact {
	return JSON.parse(
		readAtlasPayload(repositoryRootOf(apiRoot), "postcode-areas"),
	);
}

export function readSqlitePostcodeAreaShard(
	apiRoot: string,
	path: string,
): string {
	const database = new DatabaseSync(atlasDatabasePath(apiRoot), {
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
