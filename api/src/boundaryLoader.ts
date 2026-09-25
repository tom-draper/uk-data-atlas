import { readFileSync } from "node:fs";
import { join } from "node:path";
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
import type { TerrainCatalogue } from "./terrainCatalogue";

const publicPath = (apiRoot: string, filename: string) =>
	join(apiRoot, "public", filename);

export const readBoundaryRegistry = (apiRoot: string): BoundaryRegistry => {
	const path = publicPath(apiRoot, "boundary-releases.json");
	const registry = JSON.parse(readFileSync(path, "utf8")) as BoundaryRegistry;
	if (registry.schemaVersion !== 1 || !Array.isArray(registry.releases)) {
		throw new Error(`Invalid boundary registry at ${path}`);
	}
	return registry;
};

export const readGeographyInventory = (apiRoot: string): GeographyInventory => {
	const path = publicPath(apiRoot, "geography-inventory.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as GeographyInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.releases)) {
		throw new Error(`Invalid geography inventory at ${path}`);
	}
	return inventory;
};

export const readTerrainCatalogue = (apiRoot: string): TerrainCatalogue => {
	const path = publicPath(apiRoot, "terrain-catalogue.json");
	const catalogue = JSON.parse(
		readFileSync(path, "utf8"),
	) as TerrainCatalogue;
	if (catalogue.schemaVersion !== 1 || !Array.isArray(catalogue.products)) {
		throw new Error(`Invalid terrain catalogue at ${path}`);
	}
	return catalogue;
};

export const readAreaInventory = (apiRoot: string): AreaInventory => {
	const path = publicPath(apiRoot, "area-inventory.json");
	const inventory = JSON.parse(readFileSync(path, "utf8")) as AreaInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.releases)) {
		throw new Error(`Invalid area inventory at ${path}`);
	}
	return inventory;
};

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
