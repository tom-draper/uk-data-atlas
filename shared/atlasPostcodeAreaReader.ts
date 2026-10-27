import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readAtlasPayload } from "./atlasSqlite";
import { readPostcodeAreaShard } from "./atlasPostcodeAreaShard";
import type { PostcodeAreasArtifact } from "./postcodeAreaTypes";

export function readSqlitePostcodeAreas(
	apiRoot: string,
): PostcodeAreasArtifact {
	return JSON.parse(
		readAtlasPayload(resolve(apiRoot, "../.."), "postcode-areas"),
	);
}

export function readSqlitePostcodeAreaShard(
	apiRoot: string,
	path: string,
): string {
	const database = new DatabaseSync(
		resolve(apiRoot, "../../data/build/atlas.sqlite"),
		{ readOnly: true },
	);
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
