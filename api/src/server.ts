import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BoundaryRegistry } from "./boundaryRegistry";
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

export const createApiServer = (registry: BoundaryRegistry) =>
	createServer((request, response) => {
		const result = route(request.method, request.url, registry);
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
