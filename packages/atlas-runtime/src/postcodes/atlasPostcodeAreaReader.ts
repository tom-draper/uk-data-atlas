import { requireAtlasPayload } from "../storage/atlasSqlite.ts";
import {
	readPostcodeAreaShard,
	requirePostcodeAreaLayout,
} from "./atlasPostcodeAreaShard.ts";
import type { PostcodeAreasArtifact } from "@uk-data-atlas/geography/postcode-area-types";
import { atlasDatabasePath } from "../storage/dataLayout.ts";
import { openReadOnlyDatabase } from "../storage/readOnlyDatabase.ts";
import { unpackText } from "../storage/storedPayload.ts";

export function readSqlitePostcodeAreas(
	repositoryRoot: string,
): PostcodeAreasArtifact {
	return JSON.parse(requireAtlasPayload(repositoryRoot, "postcode-areas"));
}

export function readSqlitePostcodeAreaShard(
	repositoryRoot: string,
	path: string,
): string {
	const database = openReadOnlyDatabase(atlasDatabasePath(repositoryRoot));
	try {
		requirePostcodeAreaLayout(database);
		const artifact: PostcodeAreasArtifact = JSON.parse(
			unpackText(
				database
					.prepare(
						"SELECT payload FROM payloads WHERE id = 'postcode-areas'",
					)
					.get()!.payload,
			)!,
		);
		return readPostcodeAreaShard(database, artifact, path);
	} finally {
		database.release();
	}
}
