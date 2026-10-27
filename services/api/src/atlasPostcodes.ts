import { readSqlitePostcodeShard } from "../../../shared/atlasPostcodeShard";
export {
	postcodeFields,
	postcodeDistrictWhere,
	readSqlitePostcodeShard,
} from "../../../shared/atlasPostcodeShard";
import { readSqlitePostcodeIndexArtifact } from "../../../shared/atlasPostcodeIndexReader";
import { PostcodeIndex } from "./postcodes";

export const readSqlitePostcodeIndex = (apiRoot: string): PostcodeIndex => {
	const artifact = readSqlitePostcodeIndexArtifact(apiRoot);
	const entries = new Map(
		artifact.shards.map((entry) => [entry.path, entry]),
	);
	return new PostcodeIndex(artifact, (path) => {
		const entry = entries.get(path);
		if (!entry) throw new Error(`Unknown postcode shard ${path}`);
		return readSqlitePostcodeShard(apiRoot, entry);
	});
};
