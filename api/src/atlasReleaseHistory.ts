import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { AtlasRelease } from "./atlasRelease";

export const atlasReleaseDirectoryName = (releaseId: string) =>
	releaseId.replace("sha256:", "sha256-");

const readRelease = (path: string): AtlasRelease => {
	const release = JSON.parse(readFileSync(path, "utf8")) as AtlasRelease;
	if (release.schemaVersion !== 1 || !Array.isArray(release.artifacts)) {
		throw new Error(`Invalid atlas release manifest at ${path}`);
	}
	return release;
};

/**
 * Preserve the last complete release manifest before compilers replace the
 * current one. Artifact hashes make this a compact, immutable audit record;
 * it intentionally does not pretend to retain historical data files.
 */
export const archiveCurrentAtlasRelease = (publicDirectory: string) => {
	const currentPath = join(publicDirectory, "atlas-release.json");
	if (!existsSync(currentPath)) return undefined;
	const release = readRelease(currentPath);
	const archivePath = join(
		publicDirectory,
		"atlas-releases",
		`${atlasReleaseDirectoryName(release.releaseId)}.json`,
	);
	if (existsSync(archivePath)) {
		const archived = readRelease(archivePath);
		if (archived.releaseId !== release.releaseId) {
			throw new Error(
				`Conflicting archived atlas release at ${archivePath}`,
			);
		}
		return archived;
	}
	mkdirSync(join(publicDirectory, "atlas-releases"), { recursive: true });
	writeFileSync(archivePath, `${JSON.stringify(release, null, "\t")}\n`);
	return release;
};

export const readArchivedAtlasReleases = (publicDirectory: string) => {
	const directory = join(publicDirectory, "atlas-releases");
	if (!existsSync(directory)) return [];
	return readdirSync(directory)
		.filter((file) => file.endsWith(".json"))
		.map((file) => readRelease(join(directory, file)))
		.sort((left, right) => left.releaseId.localeCompare(right.releaseId));
};
