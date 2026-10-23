import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { sha256 } from "./contentHash";
import { hashFile } from "./fileHashCache";
import type { MapResources } from "./mapResourceLoader";

export type AtlasReleaseArtifactRef = {
	id: string;
	/** On-disk path relative to the repository root. */
	path: string;
	contentHash: string;
};

/** Identifies the files served by the current build. No history is retained. */
export type AtlasRelease = {
	schemaVersion: 1;
	releaseId: string;
	artifacts: AtlasReleaseArtifactRef[];
};

// Catalogues that still have runtime JSON readers. Migrated data is covered by atlas.sqlite.
const JSON_ARTIFACTS = [
	"place-index",
	"area-search-index",
	"postcode-index",
	"postcode-areas",
	"postcode-counts",
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
	const publicDirectory = join(repositoryRoot, "services/api/public");
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
				join(publicDirectory, resource.tiles.artifact),
			),
		);
	}
	for (const id of ["evidence-documents", "atlas-lookups"]) {
		const path = join(publicDirectory, `${id}.json`);
		if (existsSync(path)) artifacts.push(artifactReference(id, path));
	}
	artifacts.sort((a, b) => a.id.localeCompare(b.id));
	return {
		schemaVersion: 1,
		releaseId: sha256(JSON.stringify({ artifacts })),
		artifacts,
	};
};
