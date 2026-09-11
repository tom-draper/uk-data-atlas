import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type AtlasReleaseArtifactRef = {
	id: string;
	path: string;
	contentHash: string;
};

export type AtlasRelease = {
	schemaVersion: 1;
	releaseId: string;
	artifacts: AtlasReleaseArtifactRef[];
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const RELEASE_ARTIFACTS: Array<{ id: string; path: string }> = [
	{ id: "boundary-registry", path: "boundary-releases.json" },
	{ id: "derived-boundaries", path: "derived-boundaries.json" },
	{ id: "area-inventory", path: "area-inventory.json" },
	{ id: "crosswalk-inventory", path: "crosswalk-inventory.json" },
	{ id: "geography-inventory", path: "geography-inventory.json" },
	{ id: "source-inventory", path: "source-inventory.json" },
];

export const createAtlasRelease = (publicDirectory: string): AtlasRelease => {
	const artifacts = RELEASE_ARTIFACTS.map(({ id, path }) => {
		const fullPath = join(publicDirectory, path);
		if (!existsSync(fullPath)) {
			throw new Error(
				`${id}: build ${path} before building the atlas release manifest`,
			);
		}
		return {
			id,
			path,
			contentHash: sha256(readFileSync(fullPath, "utf8")),
		};
	});
	const releaseId = sha256(JSON.stringify({ artifacts }));
	return { schemaVersion: 1, releaseId, artifacts };
};
