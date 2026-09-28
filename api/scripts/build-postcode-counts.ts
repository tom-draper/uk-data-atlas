import { readFileSync, writeFileSync } from "node:fs";
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
import type { PostcodeIndexArtifact, PostcodeShard } from "../src/postcodes";

const read = <T>(path: string): T =>
	JSON.parse(readFileSync(path, "utf8")) as T;

export const buildPostcodeCounts = (repositoryRoot: string) => {
	const publicRoot = join(repositoryRoot, "api", "public");
	const postcodeIndex = read<PostcodeIndexArtifact>(
		join(publicRoot, "postcode-index.json"),
	);
	const postcodeAreas = read<PostcodeAreasArtifact>(
		join(publicRoot, "postcode-areas.json"),
	);
	const artifact = compilePostcodeCounts(
		postcodeIndex,
		postcodeAreas,
		(path) => read<PostcodeShard>(join(publicRoot, path)),
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
	const result = buildPostcodeCounts(resolve(dirname(scriptPath), "../.."));
	console.log(
		`Wrote postcode counts for ${result.countedAreas} area-release entries to ${result.outputPath}`,
	);
}
