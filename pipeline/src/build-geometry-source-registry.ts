import { isMainModule } from "./lib/entrypoint.ts";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AreaInventory, AreaReleaseArtifact } from "@uk-data-atlas/areas";
import { createFileHashCache } from "./fileHashCache.ts";
import { createGeometrySourceRegistry } from "./geographies/geometrySourceRegistry.ts";
import {
	artifactDirectory,
	buildLog,
	formatCount,
	repoPath,
} from "@uk-data-atlas/atlas-db";
import { readJsonSync } from "./lib/json.ts";
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
const path = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const result = buildGeometrySourceRegistry(resolve(dirname(path), "../.."));
	buildLog.info(
		`Wrote ${formatCount(result.count)} geometry sources to ${repoPath(result.path)}`,
	);
}
