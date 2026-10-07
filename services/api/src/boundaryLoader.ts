import { readFileSync } from "node:fs";
import {
	createAreaLookup,
	type AreaInventory,
	type AreaLookup,
	type AreaReleaseArtifact,
} from "./areaInventory";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type { GeographyInventory } from "./geographyInventory";
import type { NamedLocationInventory } from "./namedLocations";
import { placeIndexMismatch, type PlaceIndexArtifact } from "./placeIndex";
import {
	areaSearchIndexMismatch,
	type AreaSearchIndexArtifact,
} from "./areaSearch";
import {
	PostcodeIndex,
	postcodeIndexMismatch,
	type PostcodeIndexArtifact,
} from "./postcodes";
import {
	PostcodeAreaIndex,
	postcodeAreasMismatch,
	type PostcodeAreasArtifact,
} from "./postcodeAreas";
import {
	PostcodeCountsIndex,
	postcodeCountsMismatch,
	type PostcodeCountsArtifact,
} from "./postcodeCounts";
import type { GeometrySourceLookup } from "./areaGeometry";
import type { TerrainCatalogue } from "./terrainCatalogue";
import { publicPath, readPublicManifest } from "./publicManifest";

export const readBoundaryRegistry = (apiRoot: string): BoundaryRegistry =>
	readPublicManifest<BoundaryRegistry>(
		apiRoot,
		"boundary-releases.json",
		"releases",
		"boundary registry",
	);

export const readGeographyInventory = (apiRoot: string): GeographyInventory =>
	readPublicManifest<GeographyInventory>(
		apiRoot,
		"geography-inventory.json",
		"releases",
		"geography inventory",
	);

export const readTerrainCatalogue = (apiRoot: string): TerrainCatalogue =>
	readPublicManifest<TerrainCatalogue>(
		apiRoot,
		"terrain-catalogue.json",
		"products",
		"terrain catalogue",
	);

export const readAreaInventory = (apiRoot: string): AreaInventory =>
	readPublicManifest<AreaInventory>(
		apiRoot,
		"area-inventory.json",
		"releases",
		"area inventory",
	);

export const readAreaLookup = (
	apiRoot: string,
	inventory = readAreaInventory(apiRoot),
): AreaLookup => {
	const artifacts = inventory.releases.flatMap((release) => {
		if (release.status !== "available") return [];
		const path = publicPath(apiRoot, release.artifact);
		const artifact = JSON.parse(
			readFileSync(path, "utf8"),
		) as AreaReleaseArtifact;
		if (
			artifact.schemaVersion !== 1 ||
			artifact.contentHash !== release.contentHash ||
			!Array.isArray(artifact.areas)
		) {
			throw new Error(`Invalid area release artifact at ${path}`);
		}
		return [artifact];
	});
	return createAreaLookup(artifacts);
};

/** The compiled place index, refused unless built from these very inputs. */
export const readPlaceIndex = (
	apiRoot: string,
	areaInventory: AreaInventory,
	namedLocations: NamedLocationInventory,
): PlaceIndexArtifact => {
	const path = publicPath(apiRoot, "place-index.json");
	const index = JSON.parse(readFileSync(path, "utf8")) as PlaceIndexArtifact;
	const mismatch = placeIndexMismatch(
		index,
		areaInventory.contentHash,
		namedLocations,
	);
	if (mismatch) {
		throw new Error(
			`The place index at ${path} ${mismatch}. Run pnpm build:place-index.`,
		);
	}
	return index;
};

/**
 * The compiled postcode index. Only its manifest is read here; each area's
 * shard is read, and checked against the manifest, on first use.
 */
export const readPostcodeIndex = (apiRoot: string): PostcodeIndex => {
	const path = publicPath(apiRoot, "postcode-index.json");
	const artifact = JSON.parse(
		readFileSync(path, "utf8"),
	) as PostcodeIndexArtifact;
	const mismatch = postcodeIndexMismatch(artifact);
	if (mismatch) {
		throw new Error(
			`The postcode index at ${path} ${mismatch}. Run pnpm build:postcode-index.`,
		);
	}
	return new PostcodeIndex(artifact, (shard) =>
		readFileSync(publicPath(apiRoot, shard), "utf8"),
	);
};

/**
 * The compiled postcode area index, refused unless built from this postcode
 * index and the current areas and geometry of every release it holds.
 */
export const readPostcodeAreaIndex = (
	apiRoot: string,
	postcodeIndex: PostcodeIndex,
	areaInventory: AreaInventory,
	geometrySources: GeometrySourceLookup,
): PostcodeAreaIndex => {
	const path = publicPath(apiRoot, "postcode-areas.json");
	const artifact = JSON.parse(
		readFileSync(path, "utf8"),
	) as PostcodeAreasArtifact;
	const mismatch = postcodeAreasMismatch(artifact, postcodeIndex.artifact, {
		areaRelease: (geography, boundaryRelease) => {
			const release = areaInventory.releases.find(
				(entry) =>
					entry.geography === geography &&
					entry.id === boundaryRelease,
			);
			return release?.status === "available"
				? release.contentHash
				: undefined;
		},
		geometryInput: (geography, boundaryRelease) =>
			geometrySources.get(`${geography}/${boundaryRelease}`)?.inputHash,
	});
	if (mismatch) {
		throw new Error(
			`The postcode area index at ${path} ${mismatch}. Run pnpm build:postcode-areas.`,
		);
	}
	return new PostcodeAreaIndex(artifact, postcodeIndex, (shard) =>
		readFileSync(publicPath(apiRoot, shard), "utf8"),
	);
};

/** The per-area postcode counts, refused unless built from these indexes. */
export const readPostcodeCounts = (
	apiRoot: string,
	postcodeIndex: PostcodeIndex,
	postcodeAreas: PostcodeAreaIndex,
): PostcodeCountsIndex => {
	const path = publicPath(apiRoot, "postcode-counts.json");
	const artifact = JSON.parse(
		readFileSync(path, "utf8"),
	) as PostcodeCountsArtifact;
	const mismatch = postcodeCountsMismatch(
		artifact,
		postcodeIndex.artifact,
		postcodeAreas.artifact,
	);
	if (mismatch)
		throw new Error(
			`The postcode counts at ${path} ${mismatch}. Run pnpm build:postcode-counts.`,
		);
	return new PostcodeCountsIndex(
		artifact,
		postcodeIndex.artifact.source.edition,
	);
};

/** The compiled area search index, refused unless built from this inventory. */
export const readAreaSearchIndex = (
	apiRoot: string,
	areaInventory: AreaInventory,
): AreaSearchIndexArtifact => {
	const path = publicPath(apiRoot, "area-search-index.json");
	const index = JSON.parse(
		readFileSync(path, "utf8"),
	) as AreaSearchIndexArtifact;
	const mismatch = areaSearchIndexMismatch(index, areaInventory.contentHash);
	if (mismatch) {
		throw new Error(
			`The area search index at ${path} ${mismatch}. Run pnpm build:area-search-index.`,
		);
	}
	return index;
};
