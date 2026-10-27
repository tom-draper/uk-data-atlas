import { join } from "node:path";
import {
	readSqlitePostcodeAreas,
	readSqlitePostcodeAreaShard,
} from "./atlasPostcodeAreaReader";
import { readSqlitePostcodeIndexArtifact } from "./atlasPostcodeIndexReader";
import { readSqlitePostcodeShard } from "./atlasPostcodeShard";
import { compilePostcodeCounts } from "./compilePostcodeCounts";
import { storePostcodeCounts } from "./storePostcodeCounts";
import type { PostcodeShard } from "./postcodeIndexTypes";

export const buildPostcodeCounts = (repositoryRoot: string) => {
	const apiRoot = join(repositoryRoot, "services/api");
	const postcodeIndex = readSqlitePostcodeIndexArtifact(apiRoot);
	const entries = new Map(
		postcodeIndex.shards.map((entry) => [entry.path, entry]),
	);
	const postcodeAreas = readSqlitePostcodeAreas(apiRoot);
	const artifact = compilePostcodeCounts(
		postcodeIndex,
		postcodeAreas,
		(path) => {
			const entry = entries.get(path);
			if (!entry) throw new Error(`Unknown postcode district ${path}`);
			const shard: PostcodeShard = JSON.parse(
				readSqlitePostcodeShard(apiRoot, entry),
			);
			return shard;
		},
		(path) => JSON.parse(readSqlitePostcodeAreaShard(apiRoot, path)),
	);
	const outputPath = storePostcodeCounts(repositoryRoot, artifact);
	const countedAreas = artifact.releases.reduce(
		(count, release) => count + Object.keys(release.areas).length,
		0,
	);
	return { outputPath, artifact, countedAreas };
};
