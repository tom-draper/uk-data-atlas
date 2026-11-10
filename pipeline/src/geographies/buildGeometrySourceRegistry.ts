import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AreaInventory, AreaReleaseArtifact } from "@uk-data-atlas/areas";
import { createFileHashCache } from "../lib/fileHashCache.ts";
import { createGeometrySourceRegistry } from "./geometrySourceRegistry.ts";
import { artifactDirectory } from "@uk-data-atlas/atlas-db";
import { readJsonSync } from "../lib/json.ts";
export const buildGeometrySourceRegistry = (root: string) => {
	const out = artifactDirectory(root);
	if (!existsSync(out))
		throw new Error(
			"Create the API public directory before building geometry sources.",
		);
	const inventory = readJsonSync(
		join(out, "area-inventory.json"),
	) as AreaInventory;
	const artifacts = inventory.releases.flatMap((r) =>
		r.status === "available"
			? [readJsonSync(join(out, r.artifact)) as AreaReleaseArtifact]
			: [],
	);
	const hashes = createFileHashCache(
		join(
			root,
			"node_modules",
			".cache",
			"uk-data-atlas",
			"input-hashes.json",
		),
	);
	const registry = createGeometrySourceRegistry(root, artifacts, (input) =>
		hashes.hash(input),
	);
	hashes.save();
	const path = join(out, "geometry-sources.json");
	writeFileSync(path, JSON.stringify(registry, null, "\t") + "\n");
	return { path, count: registry.releases.length };
};
