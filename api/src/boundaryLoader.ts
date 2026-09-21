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
