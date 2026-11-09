import { requireAtlasPayload } from "@uk-data-atlas/atlas-db";
import {
	readPostcodeAreaShard,
	requirePostcodeAreaLayout,
} from "./atlasPostcodeAreaShard.ts";
import type { PostcodeAreasArtifact } from "@uk-data-atlas/geography/postcode-area-types";
import { atlasDatabasePath } from "@uk-data-atlas/atlas-db";
import { openReadOnlyDatabase } from "@uk-data-atlas/atlas-db";
import { unpackText } from "@uk-data-atlas/atlas-db";

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
