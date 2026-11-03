import { readFileSync } from "node:fs";
import { join } from "node:path";
import { artifactDirectory } from "./dataLayout";

export const publicPath = (repositoryRoot: string, filename: string) =>
	join(artifactDirectory(repositoryRoot), filename);

/**
 * A compiled schema-1 manifest from `public/`, refused unless `listKey` holds
 * an array. `label` names the manifest in the error.
 */
export const readPublicManifest = <T extends { schemaVersion: number }>(
	repositoryRoot: string,
	filename: string,
	listKey: keyof T & string,
	label: string,
): T => {
	const path = publicPath(repositoryRoot, filename);
	const manifest = JSON.parse(readFileSync(path, "utf8")) as T;
	if (manifest.schemaVersion !== 1 || !Array.isArray(manifest[listKey])) {
		throw new Error(`Invalid ${label} at ${path}`);
	}
	return manifest;
};
