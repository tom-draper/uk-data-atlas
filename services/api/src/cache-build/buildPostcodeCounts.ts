import {
	readSqlitePostcodeAreas,
	readSqlitePostcodeAreaShard,
} from "../../../../shared/atlasPostcodeAreaReader";
import { readSqlitePostcodeIndexArtifact } from "../../../../shared/atlasPostcodeIndexReader";
import { readSqlitePostcodeShard } from "../../../../shared/atlasPostcodeShard";
import { compilePostcodeCounts } from "./compilePostcodeCounts";
import { storePostcodeCounts } from "../../../../shared/storePostcodeCounts";
import type { PostcodeShard } from "@uk-data-atlas/geography/postcode-index-types";
import { apiRootOf } from "../../../../shared/dataLayout";

export const buildPostcodeCounts = (repositoryRoot: string) => {
	const apiRoot = apiRootOf(repositoryRoot);
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
