import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createAtlasRelease } from "./atlasRelease.ts";
import { artifactDirectory } from "@uk-data-atlas/atlas-db";

export const buildAtlasRelease = (repositoryRoot: string) => {
	const outputDirectory = artifactDirectory(repositoryRoot);
	if (!existsSync(outputDirectory)) {
		throw new Error(
			`Create the API public directory before building: ${outputDirectory}`,
		);
	}
	const release = createAtlasRelease(repositoryRoot);
	const releasePath = join(outputDirectory, "atlas-release.json");
	writeFileSync(releasePath, `${JSON.stringify(release, null, "\t")}\n`);
	return { releasePath, releaseId: release.releaseId };
};
