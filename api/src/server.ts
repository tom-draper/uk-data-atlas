import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type { GeographyInventory } from "./geographyInventory";
import { route } from "./routes";

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

export type ApiCatalogues = {
	boundaryRegistry: BoundaryRegistry;
	geographyInventory: GeographyInventory;
};

export const readApiCatalogues = (apiRoot: string): ApiCatalogues => ({
	boundaryRegistry: readBoundaryRegistry(apiRoot),
	geographyInventory: readGeographyInventory(apiRoot),
});

export const createApiServer = ({
	boundaryRegistry,
	geographyInventory,
}: ApiCatalogues) =>
	createServer((request, response) => {
		const result = route(
			request.method,
			request.url,
			boundaryRegistry,
			geographyInventory,
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
