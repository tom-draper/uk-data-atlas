import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import type { AtlasRelease, AtlasReleaseArtifactRef } from "./atlasRelease";

export const atlasReleaseDirectoryName = (releaseId: string) =>
	releaseId.replace("sha256:", "sha256-");

const artifactDirectory = (publicDirectory: string, releaseId: string) =>
	join(
		publicDirectory,
		"atlas-releases",
		atlasReleaseDirectoryName(releaseId),
		"artifacts",
	);

const sha256 = (path: string) =>
	`sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;

const artifactPath = (
	publicDirectory: string,
	releaseId: string,
	path: string,
) => join(artifactDirectory(publicDirectory, releaseId), path);

const copyArtifact = (
	publicDirectory: string,
	releaseId: string,
	artifact: AtlasReleaseArtifactRef,
) => {
	const source = join(publicDirectory, artifact.path);
	if (!existsSync(source))
		throw new Error(
			`Cannot archive ${artifact.id}: ${artifact.path} is not present in ${publicDirectory}.`,
		);
	if (sha256(source) !== artifact.contentHash)
		throw new Error(
			`Cannot archive ${artifact.id}: ${artifact.path} does not match release ${releaseId}.`,
		);
	const destination = artifactPath(publicDirectory, releaseId, artifact.path);
	if (existsSync(destination)) {
		if (sha256(destination) !== artifact.contentHash)
			throw new Error(`Conflicting archived artifact at ${destination}.`);
		return;
	}
	mkdirSync(dirname(destination), { recursive: true });
	copyFileSync(source, destination);
};

const readRelease = (path: string): AtlasRelease => {
	const release = JSON.parse(readFileSync(path, "utf8")) as AtlasRelease;
	if (release.schemaVersion !== 1 || !Array.isArray(release.artifacts)) {
		throw new Error(`Invalid atlas release manifest at ${path}`);
	}
	return release;
};

/**
 * Preserve the last complete release manifest before compilers replace the
 * current one. The manifest and every artifact it declares are copied under
 * the release id, so a sync client can retrieve the exact bytes it pinned.
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
	let archived: AtlasRelease | undefined;
	if (existsSync(archivePath)) {
		archived = readRelease(archivePath);
		if (
			archived.releaseId !== release.releaseId ||
			JSON.stringify(archived.artifacts) !==
				JSON.stringify(release.artifacts)
		) {
			throw new Error(
				`Conflicting archived atlas release at ${archivePath}`,
			);
		}
		// Fingerprints are read from the same artifacts, so an archive made
		// before they were recorded can gain them without changing the release.
		if (!archived.resources && release.resources) {
			writeFileSync(
				archivePath,
				`${JSON.stringify(release, null, "\t")}\n`,
			);
			archived = release;
		}
	} else {
		mkdirSync(join(publicDirectory, "atlas-releases"), { recursive: true });
		writeFileSync(archivePath, `${JSON.stringify(release, null, "\t")}\n`);
		archived = release;
	}
	for (const artifact of release.artifacts)
		copyArtifact(publicDirectory, release.releaseId, artifact);
	return archived;
};

/** Reads release-declared bytes from one artifact root after verifying its hash. */
export const readAtlasReleaseArtifact = (
	artifactRoot: string,
	release: AtlasRelease,
	artifactId: string,
) => {
	const artifact = release.artifacts.find((entry) => entry.id === artifactId);
	if (!artifact) return undefined;
	const path = join(artifactRoot, artifact.path);
	if (!existsSync(path) || sha256(path) !== artifact.contentHash)
		return undefined;
	return { artifact, body: readFileSync(path) };
};

/** Reads an immutable archived artifact snapshot after checking its manifest. */
export const readArchivedAtlasReleaseArtifact = (
	publicDirectory: string,
	release: AtlasRelease,
	artifactId: string,
) =>
	readAtlasReleaseArtifact(
		artifactDirectory(publicDirectory, release.releaseId),
		release,
		artifactId,
	);

export const readArchivedAtlasReleases = (publicDirectory: string) => {
	const directory = join(publicDirectory, "atlas-releases");
	if (!existsSync(directory)) return [];
	return readdirSync(directory)
		.filter((file) => file.endsWith(".json"))
		.map((file) => readRelease(join(directory, file)))
		.sort((left, right) => left.releaseId.localeCompare(right.releaseId));
};
