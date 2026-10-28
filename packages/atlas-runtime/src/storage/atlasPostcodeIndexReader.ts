import { readAtlasPayload } from "./atlasSqlite";
import { postcodeIndexMismatch } from "../postcodes/postcodeIndexMismatch";
import type { PostcodeIndexArtifact } from "@uk-data-atlas/geography/postcode-index-types";
import { repositoryRootOf } from "./dataLayout";

export const readSqlitePostcodeIndexArtifact = (
	apiRoot: string,
): PostcodeIndexArtifact => {
	const artifact: PostcodeIndexArtifact = JSON.parse(
		readAtlasPayload(repositoryRootOf(apiRoot), "postcode-index"),
	);
	const mismatch = postcodeIndexMismatch(artifact);
	if (mismatch)
		throw new Error(
			`The SQLite postcode index ${mismatch}. Run pnpm data:build --only postcode-index.`,
		);
	return artifact;
};
