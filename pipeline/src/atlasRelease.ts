import { atlasAssetsDirectory } from "../../shared/atlasAssets";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { sha256 } from "../../shared/contentHash";
import { hashFile } from "./fileHashCache";
import type { MapResources } from "@uk-data-atlas/map-tiles/mapResources";

import type {
	AtlasRelease,
	AtlasReleaseArtifactRef,
} from "../../shared/atlasRelease";
import { artifactDirectory } from "../../shared/dataLayout";

// Catalogues that still have runtime JSON readers. Migrated data is covered by atlas.sqlite.
const JSON_ARTIFACTS = [
	"data-catalog",
	"measure-compatibility",
	"export-manifest",
	"lookup-manifest",
	"map-resources",
	"geometry-sources",
	"relationship-candidates",
	"validation-report",
];

export const createAtlasRelease = (repositoryRoot: string): AtlasRelease => {
	const publicDirectory = artifactDirectory(repositoryRoot);
	const artifactReference = (
		id: string,
		path: string,
	): AtlasReleaseArtifactRef => {
		if (!existsSync(path))
			throw new Error(
				`${id}: build ${relative(repositoryRoot, path)} before building the atlas release manifest`,
			);
		return {
			id,
			path: relative(repositoryRoot, path).replaceAll("\\", "/"),
			contentHash: hashFile(path),
		};
	};
	const artifacts = [
		artifactReference(
			"atlas-sqlite",
			join(repositoryRoot, "data/build/atlas.sqlite"),
		),
		...JSON_ARTIFACTS.map((id) =>
			artifactReference(id, join(publicDirectory, `${id}.json`)),
		),
	];
	const maps: MapResources = JSON.parse(
		readFileSync(join(publicDirectory, "map-resources.json"), "utf8"),
	);
	for (const resource of maps.resources) {
		artifacts.push(
			artifactReference(
				`boundary-tiles/${resource.id}`,
				join(repositoryRoot, "data/build", resource.tiles.artifact),
			),
		);
	}
	for (const id of ["evidence-documents", "atlas-lookups"]) {
		const directory =
			id === "atlas-lookups"
				? atlasAssetsDirectory(repositoryRoot)
				: publicDirectory;
		const path = join(directory, `${id}.json`);
		if (existsSync(path)) artifacts.push(artifactReference(id, path));
	}
	artifacts.sort((a, b) => a.id.localeCompare(b.id));
	return {
		schemaVersion: 1,
		releaseId: sha256(JSON.stringify({ artifacts })),
		artifacts,
	};
};
