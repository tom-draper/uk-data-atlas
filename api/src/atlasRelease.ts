import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	isLegacyPopulationSource,
	observationArtifactName,
	type DataCatalog,
} from "./dataCatalog";

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
	{ id: "named-locations", path: "named-locations.json" },
	{ id: "data-catalog", path: "data-catalog.json" },
	{ id: "measure-compatibility", path: "measure-compatibility.json" },
	{ id: "export-manifest", path: "export-manifest.json" },
	{ id: "population-observations", path: "population-observations.json" },
	{
		id: "population-local-authority-observations",
		path: "population-local-authority-observations.json",
	},
	{ id: "geometry-sources", path: "geometry-sources.json" },
	{ id: "crosswalk-inventory", path: "crosswalk-inventory.json" },
	{ id: "relationship-candidates", path: "relationship-candidates.json" },
	{ id: "geography-inventory", path: "geography-inventory.json" },
	{ id: "validation-report", path: "validation-report.json" },
	{ id: "source-inventory", path: "source-inventory.json" },
];

/**
 * Observation artifacts are catalogued per measure source. Deriving them from
 * the data catalogue means adding a source cannot leave a release manifest
 * that pins the description but not the observations it serves.
 */
const cataloguedObservationArtifacts = (
	publicDirectory: string,
): Array<{ id: string; path: string }> => {
	const catalogPath = join(publicDirectory, "data-catalog.json");
	const catalog = JSON.parse(
		readFileSync(catalogPath, "utf8"),
	) as Partial<DataCatalog>;
	if (!Array.isArray(catalog.measures)) return [];
	const artifacts = new Map<string, { id: string; path: string }>();
	for (const measure of catalog.measures) {
		for (const source of measure.sources ?? []) {
			if (isLegacyPopulationSource(measure.id, source)) continue;
			const stem = observationArtifactName(measure.id, source);
			artifacts.set(stem, {
				id: `observations/${stem}`,
				path: `${stem}.json`,
			});
		}
	}
	return [...artifacts.values()].sort((left, right) =>
		left.id.localeCompare(right.id),
	);
};

export const createAtlasRelease = (publicDirectory: string): AtlasRelease => {
	const artifactReference = ({ id, path }: { id: string; path: string }) => {
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
	};
	const artifacts = [
		...RELEASE_ARTIFACTS.map(artifactReference),
		...cataloguedObservationArtifacts(publicDirectory).map(
			artifactReference,
		),
	];
	const releaseId = sha256(JSON.stringify({ artifacts }));
	return { schemaVersion: 1, releaseId, artifacts };
};
