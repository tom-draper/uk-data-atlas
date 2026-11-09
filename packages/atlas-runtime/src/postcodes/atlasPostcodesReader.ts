import { readSqlitePostcodeShard } from "./atlasPostcodeShard.ts";
export {
	postcodeFields,
	postcodeDistrictWhere,
	readSqlitePostcodeShard,
} from "./atlasPostcodeShard.ts";
import { readSqlitePostcodeIndexArtifact } from "./atlasPostcodeIndexReader.ts";
import { PostcodeIndex } from "@uk-data-atlas/postcodes";

export const readSqlitePostcodeIndex = (
	repositoryRoot: string,
	databasePath?: string,
): PostcodeIndex => {
	const artifact = readSqlitePostcodeIndexArtifact(
		repositoryRoot,
		databasePath,
	);
	const entries = new Map(
		artifact.shards.map((entry) => [entry.path, entry]),
	);
	return new PostcodeIndex(artifact, (path) => {
		const entry = entries.get(path);
		if (!entry) throw new Error(`Unknown postcode shard ${path}`);
		return readSqlitePostcodeShard(repositoryRoot, entry, databasePath);
	});
};
