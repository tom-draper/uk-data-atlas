import { readPostcodeIndex } from "../src/boundaryLoader";
import { readSqlitePostcodeShard } from "../src/atlasPostcodes";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	compilePostcodeCounts,
	type PostcodeCountsArtifact,
} from "../src/postcodeCounts";
import type {
	PostcodeAreasArtifact,
	PostcodeAreasShard,
} from "../src/postcodeAreas";
import type { PostcodeShard } from "../src/postcodes";
import { readStoredText } from "../src/storedText";

// Postcode-to-area shards remain gzipped; postcode records come from SQLite.
const read = <T>(path: string): T => JSON.parse(readStoredText(path)) as T;

export const buildPostcodeCounts = (repositoryRoot: string) => {
	const publicRoot = join(repositoryRoot, "services", "api", "public");
	const postcodeIndex = readPostcodeIndex(
		join(repositoryRoot, "services/api"),
	).artifact;
	const entries = new Map(
		postcodeIndex.shards.map((entry) => [entry.path, entry]),
	);
	const postcodeAreas = read<PostcodeAreasArtifact>(
		join(publicRoot, "postcode-areas.json"),
	);
	const artifact = compilePostcodeCounts(
		postcodeIndex,
		postcodeAreas,
		(path) => {
			const entry = entries.get(path);
			if (!entry) throw new Error(`Unknown postcode district ${path}`);
			const shard: PostcodeShard = JSON.parse(
				readSqlitePostcodeShard(
					join(repositoryRoot, "services/api"),
					entry,
				),
			);
			return shard;
		},
		(path) => read<PostcodeAreasShard>(join(publicRoot, path)),
	);
	const outputPath = join(publicRoot, "postcode-counts.json");
	writeFileSync(outputPath, `${JSON.stringify(artifact, null, "\t")}\n`);
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
