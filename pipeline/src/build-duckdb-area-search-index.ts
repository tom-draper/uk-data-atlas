import { rmSync } from "node:fs";
import { join } from "node:path";
import { areaSearchIndexTables } from "./storage/index";
import { readAreaLookup } from "@uk-data-atlas/atlas-runtime/areas";
import { readSqliteAreaInventory } from "@uk-data-atlas/atlas-runtime/storage";
import { publishCacheTables } from "./storage/index";
import { artifactDirectory } from "@uk-data-atlas/atlas-runtime/storage";
import { compileDuckdbAreaSearchIndex } from "./duckdbAreaSearch";

export async function buildDuckdbAreaSearchIndex(root: string) {
	const inventory = readSqliteAreaInventory(root);
	const index = await compileDuckdbAreaSearchIndex(
		readAreaLookup(root, inventory),
		inventory.contentHash,
	);
	const outputPath = publishCacheTables(
		root,
		"area-search",
		areaSearchIndexTables(index),
	);
	for (const name of [
		"area-search-index.sqlite",
		"area-search-index.json",
		"area-search-index.json.gz",
	])
		rmSync(join(artifactDirectory(root), name), { force: true });
	return {
		outputPath,
		areas: index.releases.reduce(
			(sum, release) => sum + release.codes.length,
			0,
		),
		terms: index.terms.length,
	};
}
