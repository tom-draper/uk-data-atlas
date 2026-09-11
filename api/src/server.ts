import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	createAreaLookup,
	type AreaInventory,
	type AreaLookup,
	type AreaReleaseArtifact,
} from "./areaInventory";
import type { AtlasRelease } from "./atlasRelease";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import type { GeographyInventory } from "./geographyInventory";
import {
	createAreaSearchIndex,
	route,
	type AreaSearchIndex,
	type CrosswalkLookup,
} from "./routes";

const registryPath = (apiRoot: string) =>
	join(apiRoot, "public", "boundary-releases.json");

export const readBoundaryRegistry = (apiRoot: string): BoundaryRegistry => {
	const registry = JSON.parse(
		readFileSync(registryPath(apiRoot), "utf8"),
	) as BoundaryRegistry;
	if (registry.schemaVersion !== 1 || !Array.isArray(registry.releases)) {
		throw new Error(
			`Invalid boundary registry at ${registryPath(apiRoot)}`,
		);
	}
	return registry;
};

export const readGeographyInventory = (apiRoot: string): GeographyInventory => {
	const path = join(apiRoot, "public", "geography-inventory.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as GeographyInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.releases)) {
		throw new Error(`Invalid geography inventory at ${path}`);
	}
	return inventory;
};

export const readAreaLookup = (apiRoot: string): AreaLookup => {
	const inventoryPath = join(apiRoot, "public", "area-inventory.json");
	const inventory = JSON.parse(
		readFileSync(inventoryPath, "utf8"),
	) as AreaInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.releases)) {
		throw new Error(`Invalid area inventory at ${inventoryPath}`);
	}
	const artifacts = inventory.releases.flatMap((release) => {
		if (release.status !== "available") return [];
		const path = join(apiRoot, "public", release.artifact);
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

export const readCrosswalkInventory = (apiRoot: string): CrosswalkInventory => {
	const path = join(apiRoot, "public", "crosswalk-inventory.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as CrosswalkInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.crosswalks)) {
		throw new Error(`Invalid crosswalk inventory at ${path}`);
	}
	return inventory;
};

export const readCrosswalkLookup = (
	apiRoot: string,
	inventory: CrosswalkInventory,
): CrosswalkLookup =>
	new Map(
		inventory.crosswalks.map((crosswalk) => {
			const path = join(apiRoot, "public", crosswalk.artifact);
			const artifact = JSON.parse(
				readFileSync(path, "utf8"),
			) as CrosswalkArtifact;
			if (
				artifact.schemaVersion !== 1 ||
				artifact.contentHash !== crosswalk.contentHash ||
				!Array.isArray(artifact.records)
			) {
				throw new Error(`Invalid crosswalk artifact at ${path}`);
			}
			return [crosswalk.id, artifact];
		}),
	);

export const readAtlasRelease = (apiRoot: string): AtlasRelease => {
	const path = join(apiRoot, "public", "atlas-release.json");
	const release = JSON.parse(readFileSync(path, "utf8")) as AtlasRelease;
	if (release.schemaVersion !== 1 || !Array.isArray(release.artifacts)) {
		throw new Error(`Invalid atlas release manifest at ${path}`);
	}
	return release;
};

export type ApiCatalogues = {
	boundaryRegistry: BoundaryRegistry;
	geographyInventory: GeographyInventory;
	areaLookup: AreaLookup;
	areaSearchIndex: AreaSearchIndex;
	crosswalkInventory: CrosswalkInventory;
	crosswalkLookup: CrosswalkLookup;
	atlasRelease: AtlasRelease;
};

export const readApiCatalogues = (apiRoot: string): ApiCatalogues => {
	const areaLookup = readAreaLookup(apiRoot);
	const crosswalkInventory = readCrosswalkInventory(apiRoot);
	return {
		boundaryRegistry: readBoundaryRegistry(apiRoot),
		geographyInventory: readGeographyInventory(apiRoot),
		areaLookup,
		areaSearchIndex: createAreaSearchIndex(areaLookup),
		crosswalkInventory,
		crosswalkLookup: readCrosswalkLookup(apiRoot, crosswalkInventory),
		atlasRelease: readAtlasRelease(apiRoot),
	};
};

export const createApiServer = ({
	boundaryRegistry,
	geographyInventory,
	areaLookup,
	areaSearchIndex,
	crosswalkInventory,
	crosswalkLookup,
	atlasRelease,
}: ApiCatalogues) =>
	createServer((request, response) => {
		const result = route(
			request.method,
			request.url,
			boundaryRegistry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			atlasRelease,
		);
		response.writeHead(result.status, {
			"cache-control": "public, max-age=300",
			"content-type":
				result.status >= 400
					? "application/problem+json"
					: "application/json",
			"x-content-type-options": "nosniff",
		});
		response.end(`${JSON.stringify(result.body)}\n`);
	});
