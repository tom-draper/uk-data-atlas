import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAtlasRelease } from "../src/atlasRelease";

export const buildAtlasRelease = (repositoryRoot: string) => {
	const outputDirectory = join(repositoryRoot, "api", "public");
	if (!existsSync(outputDirectory)) {
		throw new Error(
			`Create the API public directory before building: ${outputDirectory}`,
		);
	}
	const release = createAtlasRelease(outputDirectory);
	const releasePath = join(outputDirectory, "atlas-release.json");
	writeFileSync(releasePath, `${JSON.stringify(release, null, "\t")}\n`);
	return { releasePath, releaseId: release.releaseId };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildAtlasRelease(repositoryRoot);
	console.log(
		`Wrote atlas release ${result.releaseId} to ${result.releasePath}`,
	);
}
