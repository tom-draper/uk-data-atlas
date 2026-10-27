import {
	readSqlitePostcodeAreas,
	readSqlitePostcodeAreaShard,
} from "../src/atlasPostcodeDerived";
import { storePostcodeCounts } from "../../../shared/storePostcodeCounts";
import { readPostcodeIndex } from "../src/boundaryLoader";
import { readSqlitePostcodeShard } from "../src/atlasPostcodes";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compilePostcodeCounts } from "../../../shared/compilePostcodeCounts";
import type { PostcodeShard } from "../src/postcodes";

export const buildPostcodeCounts = (repositoryRoot: string) => {
	const apiRoot = join(repositoryRoot, "services/api");
	const postcodeIndex = readPostcodeIndex(apiRoot).artifact;
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

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = buildPostcodeCounts(
		resolve(dirname(scriptPath), "../../.."),
	);
	console.log(
		`Wrote postcode counts for ${result.countedAreas} area-release entries to ${result.outputPath}`,
	);
}
