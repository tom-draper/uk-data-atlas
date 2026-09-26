import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AreaInventory, AreaReleaseArtifact } from "../src/areaInventory";
import { createGeometrySourceRegistry } from "../src/geometrySourceRegistry";
export const buildGeometrySourceRegistry = (root: string) => {
	const out = join(root, "api", "public");
	if (!existsSync(out))
		throw new Error(
			"Create the API public directory before building geometry sources.",
		);
	const inventory = JSON.parse(
		readFileSync(join(out, "area-inventory.json"), "utf8"),
	) as AreaInventory;
	const artifacts = inventory.releases.flatMap((r) =>
		r.status === "available"
			? [
					JSON.parse(
						readFileSync(join(out, r.artifact), "utf8"),
					) as AreaReleaseArtifact,
				]
			: [],
	);
	const registry = createGeometrySourceRegistry(root, artifacts);
	const path = join(out, "geometry-sources.json");
	writeFileSync(path, JSON.stringify(registry, null, "\t") + "\n");
	return { path, count: registry.releases.length };
};
const path = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === path) {
	const result = buildGeometrySourceRegistry(resolve(dirname(path), "../.."));
	console.log(
		"Wrote " + result.count + " geometry sources to " + result.path,
	);
}
