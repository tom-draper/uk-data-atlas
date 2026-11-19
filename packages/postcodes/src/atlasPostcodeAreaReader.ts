import { requireAtlasPayload } from "@uk-data-atlas/atlas-db";
import {
	readPostcodeAreaShard,
	requirePostcodeAreaLayout,
} from "./atlasPostcodeAreaShard.ts";
import type { PostcodeAreasArtifact } from "@uk-data-atlas/geography";
import { atlasDatabasePath } from "@uk-data-atlas/atlas-db";
import {
	openBuildMetadata,
	openReadOnlyDatabase,
} from "@uk-data-atlas/atlas-db";

export function readSqlitePostcodeAreas(
	repositoryRoot: string,
): PostcodeAreasArtifact {
	return JSON.parse(requireAtlasPayload(repositoryRoot, "postcode-areas"));
}

export function readSqlitePostcodeAreaShard(
	repositoryRoot: string,
	path: string,
): string {
	const databasePath = atlasDatabasePath(repositoryRoot);
	const database = openReadOnlyDatabase(databasePath);
	try {
		requirePostcodeAreaLayout(database);
		const build = openBuildMetadata(databasePath);
		try {
			const artifact: PostcodeAreasArtifact = JSON.parse(
				requireAtlasPayload(repositoryRoot, "postcode-areas"),
			);
			return readPostcodeAreaShard(database, build, artifact, path);
		} finally {
			build.release();
		}
	} finally {
		database.release();
	}
}
