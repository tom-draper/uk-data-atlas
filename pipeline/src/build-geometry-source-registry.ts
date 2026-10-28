import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
	AreaInventory,
	AreaReleaseArtifact,
} from "@uk-data-atlas/atlas-runtime/areas";
import { createFileHashCache } from "./fileHashCache";
import { createGeometrySourceRegistry } from "./geometrySourceRegistry";
import { artifactDirectory } from "@uk-data-atlas/atlas-runtime/storage";
export const buildGeometrySourceRegistry = (root: string) => {
	const out = artifactDirectory(root);
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
if (process.argv[1] && resolve(process.argv[1]) === path) {
	const result = buildGeometrySourceRegistry(resolve(dirname(path), "../.."));
	console.log(
		"Wrote " + result.count + " geometry sources to " + result.path,
	);
}
