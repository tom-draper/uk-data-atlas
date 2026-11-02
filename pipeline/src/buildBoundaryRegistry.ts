import { readFileSync } from "node:fs";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import { buildArtifactPath } from "@uk-data-atlas/atlas-runtime/areas";

export const readBuildBoundaryRegistry = (root: string): BoundaryRegistry => {
	const path = buildArtifactPath(root, "boundary-releases.json");
	const registry = JSON.parse(readFileSync(path, "utf8")) as BoundaryRegistry;
	if (registry.schemaVersion !== 1 || !Array.isArray(registry.releases))
		throw new Error(`Invalid boundary registry in ${path}`);
	return registry;
};
