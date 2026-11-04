import { readAtlasPayload } from "./atlasSqlite.ts";
import { postcodeIndexMismatch } from "@uk-data-atlas/postcodes";
import type { PostcodeIndexArtifact } from "@uk-data-atlas/geography/postcode-index-types";

export const readSqlitePostcodeIndexArtifact = (
	repositoryRoot: string,
	databasePath?: string,
): PostcodeIndexArtifact => {
	const artifact: PostcodeIndexArtifact = JSON.parse(
		readAtlasPayload(repositoryRoot, "postcode-index", databasePath),
	);
	const mismatch = postcodeIndexMismatch(artifact);
	if (mismatch)
		throw new Error(
			`The SQLite postcode index ${mismatch}. Run pnpm data:build --only postcode-index.`,
		);
	return artifact;
};
