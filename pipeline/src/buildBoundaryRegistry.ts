import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import { buildArtifactPath } from "@uk-data-atlas/areas";
import { readJsonSync } from "./lib/json.ts";

export const readBuildBoundaryRegistry = (root: string): BoundaryRegistry => {
	const path = buildArtifactPath(root, "boundary-releases.json");
	const registry = readJsonSync(path) as BoundaryRegistry;
	if (registry.schemaVersion !== 1 || !Array.isArray(registry.releases))
		throw new Error(`Invalid boundary registry in ${path}`);
	return registry;
};
